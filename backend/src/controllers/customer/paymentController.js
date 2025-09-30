const { pool } = require('../../config/database');
const { buildCheckoutLink, hmacSign, validateSuccessState } = require('../../services/payment/infinityPayService');
const { nodeEnv } = require('../../config/environment');

function cents(v) { return Math.round((Number(v)||0) * 100); }

module.exports = {
  // POST /api/customer/payment/infinitepay/checkout-link
  // body: { orderId }
  createInfinitePayLink: async (req, res) => {
    try {
      const userId = req.usuario.id;
      const { orderId } = req.body || {};
      const id = parseInt(orderId, 10);
      if (!id) return res.status(400).json({ sucesso: false, mensagem: 'orderId inválido' });

      // Carregar pedido e itens do usuário autenticado
      const [[order]] = await pool.query(
        `SELECT id, total, status FROM pedido WHERE id = ? AND user_id = ?`, [id, userId]
      );
      if (!order) return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado' });
      if (String(order.status) === 'cancelado') return res.status(400).json({ sucesso: false, mensagem: 'Pedido cancelado' });

      const [items] = await pool.query(
        `SELECT i.quantity, i.unit_price, i.size, p.name, p.img, p.price_small, p.price_medium, p.price_large
         FROM pedido_itens i JOIN products p ON p.id = i.product_id
         WHERE i.order_id = ?`, [id]
      );
      // Base URL pública para montar URLs absolutas de imagem
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;

      // Preferência do cliente: mostrar nomes dos produtos no checkout
      // Estratégia: cada produto vira uma linha com o valor TOTAL daquele produto (com desconto proporcional embutido) e quantity=1
      // e adicionamos uma linha "Entrega" com o valor da taxa. Assim garantimos soma exata = total do pedido.

      // Precisamos dos campos de totais do pedido (garante compat):
      const [[orderTotals]] = await pool.query('SELECT subtotal, delivery_fee, discount, total FROM pedido WHERE id = ?', [id]);
      const subtotalCents = cents(orderTotals?.subtotal || 0);
      const deliveryCents = cents(orderTotals?.delivery_fee || 0);
      const discountCents = cents(orderTotals?.discount || 0);
      const totalCents = cents(orderTotals?.total || order.total);

      let mapped;
      if (subtotalCents <= 0) {
        // Fallback: sem subtotal (itens gratuitos?), enviaremos apenas o total
        const resumo = `Pedido #${order.id} — ${items.length} item${items.length === 1 ? '' : 's'}`;
        mapped = [{ name: resumo, price: totalCents, quantity: 1 }];
      } else {
        // 1) Montar linhas base por produto com totals em centavos (unit * qty)
        const baseLines = items.map(it => {
          const prices = [Number(it.price_small)||0, Number(it.price_medium)||0, Number(it.price_large)||0];
          const nonZero = prices.filter(v => v > 0).length;
          const unico = nonZero === 1;
          const sizeLabel = unico ? 'Único' : (['P','M','G'][it.size] || '');
          const nameBase = `${it.name}${Number.isFinite(it.size) ? ` (${sizeLabel})` : ''}`.trim();
          // Constrói URL absoluta da imagem
          let imageUrl = undefined;
          if (it.img) {
            const s = String(it.img);
            if (/^https?:\/\//i.test(s)) imageUrl = s; else imageUrl = `${baseUrl}${s.startsWith('/')? s : `/uploads/${s}`}`;
          }
          const unitCents = cents(it.unit_price);
          const qty = Number(it.quantity) || 1;
          const lineCents = unitCents * qty;
          return { nameBase, qty, imageUrl, lineCents };
        });

        // 2) Distribuir o desconto proporcionalmente entre as linhas
        let assigned = 0;
        const n = baseLines.length;
        const linesWithAlloc = baseLines.map((ln, idx) => {
          let alloc = 0;
          if (idx < n - 1) {
            alloc = Math.floor(ln.lineCents * discountCents / subtotalCents);
            assigned += alloc;
          } else {
            alloc = Math.max(0, discountCents - assigned); // último recebe o restante
          }
          const adjusted = Math.max(0, ln.lineCents - alloc);
          return { ...ln, adjusted };
        });

        // 3) Criar linhas finais com quantidade 1 e preço total ajustado por produto
        mapped = linesWithAlloc.map(ln => ({
          name: `${ln.nameBase}${ln.qty>1?` x${ln.qty}`:''}`,
          price: ln.adjusted,
          quantity: 1,
          image_url: ln.imageUrl
        }))
        // O provedor pode rejeitar itens com preço 0; removê-los
        .filter(it => Number(it.price) > 0);

        // 4) Linha de entrega
        if (deliveryCents > 0) mapped.push({ name: 'Entrega', price: deliveryCents, quantity: 1 });

        // 5) Garantir soma exata == total (ajuste de arredondamento, se necessário)
        const sumNow = mapped.reduce((acc, it) => acc + (Number(it.price)||0) * (Number(it.quantity)||1), 0);
        const delta = totalCents - sumNow;
        if (delta !== 0) {
          // Ajuste mínimo: criar/ajustar uma linha de "Ajuste" evitando valores negativos em itens
          const idxEntrega = mapped.findIndex(it => it.name.toLowerCase() === 'entrega');
          if (idxEntrega >= 0) {
            mapped[idxEntrega].price = Math.max(0, (Number(mapped[idxEntrega].price)||0) + delta);
          } else if (mapped.length > 0) {
            mapped[mapped.length - 1].price = Math.max(0, (Number(mapped[mapped.length - 1].price)||0) + delta);
          } else {
            mapped.push({ name: `Pedido #${order.id}`, price: totalCents, quantity: 1 });
          }
        }

        // Se após filtros não sobrou nenhuma linha positiva, criar linha de resumo única
        if (!mapped || mapped.length === 0) {
          mapped = [{ name: `Pedido #${order.id} — ${items.length} item${items.length === 1 ? '' : 's'}` , price: totalCents, quantity: 1 }];
        }
      }

      const handle = process.env.INFINITEPAY_HANDLE || (nodeEnv !== 'production' ? '$pablo_eduardo_' : '');
      const hmacSecret = process.env.INFINITEPAY_HMAC_SECRET || process.env.JWT_SECRET;
  if (!handle) return res.status(500).json({ sucesso: false, mensagem: 'Handle InfinitePay não configurado' });

      const link = buildCheckoutLink({
        handle,
        items: mapped,
        orderNSU: String(order.id),
        redirectBaseUrl: baseUrl,
        successPath: '/pay/sucesso',
        hmacSecret
      });
  // Compatibilidade: expor também no topo como linkJson.url esperado no frontend
  return res.json({ sucesso: true, url: link, data: { url: link } });
    } catch (e) {
      console.error('Erro ao criar link InfinitePay:', e);
      return res.status(500).json({ sucesso: false, mensagem: 'Falha ao criar link de pagamento' });
    }
  },

  // GET /api/customer/payment/infinitepay/success
  // query: order, state, sig
  successReturn: async (req, res) => {
    try {
      const { order, state, sig } = req.query || {};
      const secret = process.env.INFINITEPAY_HMAC_SECRET || process.env.JWT_SECRET;
      const v = validateSuccessState(state, sig, secret, 1800);
      if (!v.ok) return res.status(400).json({ sucesso: false, mensagem: 'Retorno inválido', motivo: v.reason });
      // Se o query param "order" existir, ele deve coincidir com o do state
      if (order && String(order) !== String(v.order)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Order mismatch' });
      }
      // Mantemos confirmação oficial via webhook; aqui apenas ecoamos o número
      return res.json({ sucesso: true, data: { order: String(v.order) } });
    } catch (e) {
      return res.status(400).json({ sucesso: false, mensagem: 'Retorno inválido' });
    }
  }
  ,
  // POST /api/customer/payment/infinitepay/webhook
  // body: { order_nsu, status, amount, txid, ts, sig }
  webhookInfinitePay: async (req, res) => {
    try {
      const { order_nsu, status, amount, txid, ts, sig } = req.body || {};
      if (!order_nsu || !status || !txid || !ts || !sig) return res.status(400).json({ sucesso:false, mensagem:'Payload inválido' });
      const secret = process.env.INFINITEPAY_HMAC_SECRET || process.env.JWT_SECRET;
      const base = `${order_nsu}|${status}|${amount||''}|${txid}|${ts}`;
      const expected = require('crypto').createHmac('sha256', secret).update(base).digest('hex');
      if (sig !== expected) return res.status(403).json({ sucesso:false, mensagem:'Assinatura inválida' });

      // Normalizar status vindo do provedor
      const normalized = String(status).toLowerCase();
      const isPaid = ['paid','approved','success','succeeded'].includes(normalized);
      const isFailed = ['failed','canceled','cancelled','chargeback','refunded'].includes(normalized);

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // Garantir que o pedido exista
        const [[order]] = await conn.query('SELECT id, status FROM pedido WHERE id = ?', [Number(order_nsu)]);
        if (!order) { await conn.rollback(); return res.status(404).json({ sucesso:false, mensagem:'Pedido não encontrado' }); }

        // Registrar pagamento (ignorar erro caso tabela não exista)
        try {
          // payments.txid deve ser unique para idempotência; se violar unique, ignoramos
          await conn.query(
            'INSERT INTO payments (order_id, provider, txid, status, amount, received_at) VALUES (?,?,?,?,?,NOW())',
            [order.id, 'infinitepay', String(txid), normalized, Number(amount)||0]
          );
        } catch (_) { /* noop */ }

        // Atualizar status do pedido
        const newStatus = isPaid ? 'pago' : (isFailed ? 'falha_pagamento' : 'pendente_pagamento');
        await conn.query('UPDATE pedido SET status = ? WHERE id = ?', [newStatus, order.id]);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally { conn.release(); }

      return res.json({ sucesso:true });
    } catch (e) {
      console.error('Webhook InfinitePay erro:', e);
      return res.status(500).json({ sucesso:false });
    }
  }
};
