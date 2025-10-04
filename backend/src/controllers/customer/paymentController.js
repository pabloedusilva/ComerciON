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

      // Segurança: impedir reutilização do checkout se já houver pagamento ou status pago/aprovado
      try {
        const st = String(order.status || '').toLowerCase();
        // Considerar estágios que já não devem gerar link: preparando, a_caminho, entregue, cancelado
        if (['preparando','a_caminho','entregue','cancelado'].includes(st)) {
          return res.status(400).json({ sucesso: false, mensagem: 'Pedido já em andamento ou finalizado. Crie um novo pedido.' });
        }
        const [paysExisting] = await pool.query(
          'SELECT txid FROM payments WHERE order_id = ? LIMIT 1', [id]
        );
        if (paysExisting && paysExisting.length > 0) {
          return res.status(400).json({ sucesso: false, mensagem: 'Pagamento já registrado para este pedido. Faça um novo pedido.' });
        }
      } catch (_) { /* se tabela não existir, segue fluxo */ }

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
          price: Math.max(1, Math.round(ln.adjusted)),
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
            mapped[idxEntrega].price = Math.max(1, Math.round((Number(mapped[idxEntrega].price)||0) + delta));
          } else if (mapped.length > 0) {
            mapped[mapped.length - 1].price = Math.max(1, Math.round((Number(mapped[mapped.length - 1].price)||0) + delta));
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

      // Fluxo novo: se for Intent (prefixo I), criar pedido agora (transação) se status = paga e ainda não gerado.
      let createdFromIntent = false;
      let createdOrderId = null;
      if (/^I\d+$/.test(String(v.order))) {
        const intentId = Number(String(v.order).slice(1));
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const [[intent]] = await conn.query('SELECT * FROM checkout_intents WHERE id=? FOR UPDATE', [intentId]);
          if (!intent) { await conn.rollback(); return res.status(404).json({ sucesso:false, mensagem:'Intent não encontrada' }); }
          // Novo fluxo INSTANTÂNEO: criar pedido imediatamente no successReturn (sempre que ainda não criado) sem depender de status='paga'.
          if (intent.created_order_id) {
            createdOrderId = intent.created_order_id;
            // Se já existe e falta marcar 'paga' e temos txid, atualizar status/horário
            if (intent.status !== 'paga' && intent.txid) {
              await conn.query('UPDATE checkout_intents SET status="paga", payment_received_at=COALESCE(payment_received_at,NOW()) WHERE id=?',[intentId]);
            }
            await conn.commit();
          } else {
            // Criar pedido agora; se ainda não temos txid deixamos apenas criado, e status do pedido será 'preparando'
            const [items] = await conn.query('SELECT * FROM checkout_intent_items WHERE intent_id=?', [intentId]);
            if (!items.length) { await conn.rollback(); return res.status(400).json({sucesso:false,mensagem:'Intent sem itens'}); }
            // Promover status da intent para 'paga' (considerando sucesso de retorno verificado via HMAC) para consistência
            if (intent.status !== 'paga') {
              await conn.query('UPDATE checkout_intents SET status="paga", payment_received_at=NOW() WHERE id=?',[intentId]);
            }
            // Garantir que address_json é JSON válido (string). Em intents pode estar como objeto dependendo do driver.
            let addrStr = intent.address_json;
            if (addrStr && typeof addrStr === 'object') {
              try { addrStr = JSON.stringify(addrStr); } catch(_) { addrStr = null; }
            }
            if (addrStr && typeof addrStr === 'string' && !addrStr.trim().startsWith('{')) {
              // Caso tenha sido armazenado como campo textual chave=valor (corrupção), tentar refazer minimal
              try {
                const rec = {};
                addrStr.split(',').forEach(p=>{ const m=p.split('='); if(m.length===2){ rec[m[0].replace(/`/g,'').trim()] = m[1].trim(); } });
                addrStr = JSON.stringify(rec);
              } catch(_) { addrStr = null; }
            }
            if (!addrStr) addrStr = null;
            const [orderIns] = await conn.query(
              `INSERT INTO pedido (user_id, status, subtotal, delivery_fee, discount, total, address_json, created_at)
               VALUES (?,?,?,?,?,?,?,NOW())`,
              [intent.user_id, 'preparando', intent.subtotal, intent.delivery_fee, intent.discount, intent.total, addrStr]
            );
            createdOrderId = orderIns.insertId;
            await conn.query('UPDATE checkout_intents SET created_order_id=? WHERE id=?',[createdOrderId,intentId]);
            const vals=[]; const ph=[];
            for (const it of items) { ph.push('(?,?,?,?,?,?,?,?)'); vals.push(createdOrderId, it.product_id, it.category, it.size, it.quantity, it.unit_price, it.removed_ingredients, it.name_snapshot); }
            await conn.query(`INSERT INTO pedido_itens (order_id, product_id, category, size, quantity, unit_price, removed_ingredients, name_snapshot) VALUES ${ph.join(',')}`, vals);
            // Pagamento: só podemos registrar se já houver txid (caso webhook muito rápido)
            if (intent.txid) {
              try { await conn.query('INSERT IGNORE INTO payments (order_id, provider, txid, status, amount, received_at) VALUES (?,?,?,?,?,NOW())',[createdOrderId, intent.payment_provider||'infinitepay', intent.txid, 'paid', intent.total]); } catch(_){ }
            }
            await conn.commit();
            createdFromIntent = true;
            // Emitir evento criação
            try {
              const io = req.app?.get('io');
              if (io && typeof io.emitOrderCreated === 'function') {
                let addrObj=null; try { addrObj = JSON.parse(intent.address_json||'null'); } catch(_){ }
                const [[userRow]] = await pool.query('SELECT nome, telefone FROM usuarios WHERE id=?',[intent.user_id]);
                const formatAddr = (a) => { if(!a||typeof a!=='object') return ''; const p1=[]; if(a.endereco)p1.push(a.endereco); if(a.numero)p1.push(`, ${a.numero}`); if(a.bairro)p1.push(` - ${a.bairro}`); const l1=p1.join(''); const p2=[]; if(a.cidade)p2.push(a.cidade); if(a.estado)p2.push(a.estado); const l2=p2.length? p2.join('/') : ''; const cep=a.cep? (l2?`, CEP: ${a.cep}`:`CEP: ${a.cep}`):''; const comp=a.complemento?`, ${a.complemento}`:''; return [l1,(l1&&l2)?' - ':'',l2,cep,comp].join('').trim(); };
                io.emitOrderCreated({ id: createdOrderId, total: Number(intent.total)||0, created_at: new Date().toISOString(), customer:{ name: String(userRow?.nome||'Cliente'), phone: String(userRow?.telefone||''), address: formatAddr(addrObj) } });
              }
            } catch(_){ }
          }
        } catch(errIntent){
          try { await conn.rollback(); } catch(_){ }
          console.error('Erro finalize intent -> pedido', errIntent);
        } finally { try { conn.release(); } catch(_){ } }
      }
      
      // Consulta com fallback robusto para casos onde tabela payments não existe (fluxo legado)
      let orderData = null; let payment = null;
      try {
        if (/^I\d+$/.test(String(v.order))) {
          // Se foi intent e acabamos de criar pedido, substituir referencia
          if (createdFromIntent && createdOrderId) {
            const [[orderRow]] = await pool.query('SELECT id, status, total, created_at FROM pedido WHERE id=?',[createdOrderId]);
            if (orderRow) orderData = { id: orderRow.id, status: orderRow.status, total: Number(orderRow.total)||0, created_at: orderRow.created_at };
          } else {
            // Ainda não criou pedido -> retornar estado parcial
            const intentId = Number(String(v.order).slice(1));
            const [[intentRow]] = await pool.query('SELECT id, status, total, created_at, txid FROM checkout_intents WHERE id=?',[intentId]);
            if (intentRow) {
              orderData = { id: `I${intentRow.id}`, status: intentRow.status, total: Number(intentRow.total)||0, created_at: intentRow.created_at };
              if (intentRow.status === 'paga') {
                // caso corrida: próximo refresh criará pedido
              }
            }
          }
        } else {
          const [[orderRow]] = await pool.query('SELECT id, status, total, created_at FROM pedido WHERE id = ?', [Number(v.order)]);
          if (orderRow) {
            orderData = { id: orderRow.id, status: String(orderRow.status||''), total: Number(orderRow.total)||0, created_at: orderRow.created_at };
          }
        }

        // Tentar buscar payment (com fallback se tabela não existir)
        try {
          const [payments] = await pool.query(
            'SELECT txid, status, amount, received_at FROM payments WHERE order_id = ? ORDER BY received_at DESC LIMIT 1',
            [Number(v.order)]
          );
          if (payments && payments[0]) {
            payment = {
              txid: String(payments[0].txid || ''),
              status: String(payments[0].status || ''),
              amount: Number(payments[0].amount) || 0,
              received_at: payments[0].received_at
            };
          }
        } catch(paymentErr) {
          // Tabela payments pode não existir ainda - não é crítico
          console.log('Tabela payments não disponível (será criada no primeiro webhook)');
        }
        
      } catch(err) { 
        console.error('Erro ao consultar dados do pedido:', err);
      }
      
      // Se não encontrou o pedido, retornar erro
      if (!orderData) {
        return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado' });
      }
      
      let st = String(orderData?.status||'').toLowerCase();
      let paid = ['preparando','a_caminho','entregue'].includes(st) || !!(payment && payment.txid);
      if (/^i\d+$/.test(String(orderData?.id||''))) {
        // Intent ainda não virou pedido
        paid = (st === 'paga');
      }
      
      // Retornar dados completos para exibição imediata
      return res.json({ 
        sucesso: true, 
        data: { 
          order: String(orderData?.id || v.order), 
          txid: payment?.txid || '', 
          paid, 
          total: orderData.total,
          status: orderData.status,
          created_at: orderData.created_at,
          // Incluir dados de pagamento para debug se necessário
          payment_received_at: payment?.received_at || null
        } 
      });
    } catch (e) {
      console.error('Erro no successReturn:', e);
      return res.status(400).json({ sucesso: false, mensagem: 'Retorno inválido' });
    }
  }
  ,
  // POST /api/customer/payment/infinitepay/webhook
  // Apenas Webhook "Opção 2" do InfinitePay (payload simples sem assinatura HMAC do body)
  // Exemplo:
  // {
  //   "invoice_slug": "abc123",
  //   "amount": 1000,
  //   "paid_amount": 1010,
  //   "installments": 1,
  //   "capture_method": "credit_card",
  //   "transaction_nsu": "UUID",
  //   "order_nsu": "ID-do-pedido",
  //   "receipt_url": "https://...",
  //   "items": [...]
  // }
  webhookInfinitePay: async (req, res) => {
    try {
      // Option 2 payload (sem assinatura de corpo) – agora compatível com intents prefixadas por 'I'
      const b = req.body || {};
      const orderNSU = b.order_nsu ? String(b.order_nsu) : null; // Ex.: 'I15' para intent 15 ou '123' pedido legado
      const txidRaw = b.transaction_nsu ? String(b.transaction_nsu) : null;
      const amtRaw = (b.paid_amount ?? b.amount ?? 0);
      const statusRaw = b.status || b.payment_status || b.state || '';
      if (!orderNSU || !txidRaw) return res.status(400).json({ sucesso:false, mensagem:'Payload inválido' });

      // Segurança: exigir token compartilhado no header (ou query)
      const tokenProvided = req.headers['x-webhook-token'] || req.headers['x-infinitepay-token'] || (req.query && req.query.token) || null;
      const tokenExpected = process.env.INFINITEPAY_WEBHOOK_TOKEN || '';
      if (!tokenExpected) {
        console.warn('INFINITEPAY_WEBHOOK_TOKEN ausente do .env');
        return res.status(500).json({ sucesso:false, mensagem:'Configuração ausente' });
      }
      if (!tokenProvided || tokenProvided !== tokenExpected) {
        try { console.warn('Webhook Option2 bloqueado por token ausente/incorreto'); } catch(_) {}
        return res.status(403).json({ sucesso:false, mensagem:'Token inválido' });
      }

      // (Futuro) Janela temporal poderia ser validada se o provedor enviar timestamp

    const normalized = String(statusRaw).toLowerCase();
    const isPaid = ['paid','approved','success','succeeded','aprovado'].includes(normalized);
    const isFailed = ['failed','canceled','cancelled','chargeback','refunded','cancelado'].includes(normalized);

      const isIntent = /^I\d+$/.test(orderNSU);
      let emitCreatedAfterCommit = false; // legado apenas
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        let totalRef = 0; let currentStatus = '';
        let orderId = null; // somente se fluxo legado
        if (isIntent) {
          const intentId = Number(orderNSU.slice(1));
          const [[intent]] = await conn.query('SELECT id, status, total FROM checkout_intents WHERE id=?',[intentId]);
          if(!intent){ await conn.rollback(); return res.status(404).json({sucesso:false,mensagem:'Intent não encontrada'}); }
          totalRef = Number(intent.total||0);
          currentStatus = String(intent.status||'');
        } else {
          const [[order]] = await conn.query('SELECT id, status, total FROM pedido WHERE id = ?', [Number(orderNSU)]);
          if (!order) { await conn.rollback(); return res.status(404).json({ sucesso:false, mensagem:'Pedido não encontrado' }); }
          totalRef = Number(order.total||0);
          currentStatus = String(order.status||'');
          orderId = order.id;
        }

        // Validar valor pago
        const expectedCents = Math.round(totalRef * 100);
        const raw = Number(amtRaw||0);
        const a1 = Math.round(raw);
        const a2 = Math.round(raw*100);
        const match = expectedCents && (a1===expectedCents || a2===expectedCents);
        if (!match) {
          await conn.rollback();
            return res.status(400).json({sucesso:false,mensagem:'Valor divergente'});
        }

        if (isIntent) {
          if (isPaid && currentStatus!=='paga') {
            await conn.query('UPDATE checkout_intents SET status="paga", txid=?, payment_provider="infinitepay", payment_received_at=NOW() WHERE id=?',[txidRaw, Number(orderNSU.slice(1))]);
          } else if (isFailed && currentStatus!=='cancelada') {
            await conn.query('UPDATE checkout_intents SET status="cancelada", txid=?, payment_provider="infinitepay" WHERE id=?',[txidRaw, Number(orderNSU.slice(1))]);
          }
        } else {
          // Registrar/atualizar pagamento para pedido legado
          try {
            const [[existingPayment]] = await conn.query('SELECT id, status FROM payments WHERE txid=? LIMIT 1',[txidRaw]);
            const rawAmount = Number(amtRaw||0);
            const possibleUnit = rawAmount > 1000 ? (rawAmount/100) : rawAmount;
            if (existingPayment) {
              if (isPaid && existingPayment.status !== normalized) {
                await conn.query('UPDATE payments SET status=?, amount=?, received_at=NOW() WHERE id=?',[normalized, possibleUnit, existingPayment.id]);
              }
            } else if (isPaid) {
              await conn.query('INSERT INTO payments (order_id, provider, txid, status, amount, received_at) VALUES (?,?,?,?,?,NOW())',[orderId,'infinitepay',txidRaw, normalized, possibleUnit]);
            }
          } catch(payErr){ console.error('Erro payment legado', payErr); }
          const curr = currentStatus.toLowerCase();
          let newStatus = curr;
          if (isPaid && curr==='pendente') newStatus='preparando'; else if (isFailed) newStatus='cancelado';
          if (newStatus!==curr) {
            await conn.query('UPDATE pedido SET status=? WHERE id=?',[newStatus, orderId]);
            if (curr==='pendente' && newStatus==='preparando' && isPaid) emitCreatedAfterCommit = true;
          }
        }
        await conn.commit();
      } catch(err){ await conn.rollback(); console.error('Webhook tx erro', err); return res.status(500).json({sucesso:false}); }
      finally { conn.release(); }

      // Notificar clientes em tempo real sobre pagamento aprovado
      try {
        const io = req.app && req.app.get ? req.app.get('io') : null;
        if (io) {
          // Notificação de pagamento ao cliente
          io.of('/cliente').emit('payment:paid', { orderId: orderNSU, txid: txidRaw, status: normalized, amount: Number(amtRaw)||0, isIntent: /^I\d+$/.test(orderNSU) });
          // Emissão atrasada do evento de criação para admins (apenas após pagamento)
          if (typeof io.emitOrderCreated === 'function' && emitCreatedAfterCommit) {
            // Carregar dados mínimos do pedido para o payload
            try {
              const [[row]] = await pool.query('SELECT id, total, address_json, user_id FROM pedido WHERE id = ?', [Number(orderNSU)]);
              if (row) {
                let addrObj = null; try { addrObj = JSON.parse(row.address_json || 'null'); } catch(_) {}
                const [[user]] = await pool.query('SELECT nome, telefone FROM usuarios WHERE id = ?', [row.user_id]);
                const formatAddr = (a) => {
                  if (!a || typeof a !== 'object') return '';
                  const p1 = [];
                  if (a.endereco) p1.push(a.endereco);
                  if (a.numero) p1.push(`, ${a.numero}`);
                  if (a.bairro) p1.push(` - ${a.bairro}`);
                  const l1 = p1.join('');
                  const p2 = [];
                  if (a.cidade) p2.push(a.cidade);
                  if (a.estado) p2.push(a.estado);
                  const l2 = p2.length ? p2.join('/') : '';
                  const cep = a.cep ? (l2 ? `, CEP: ${a.cep}` : `CEP: ${a.cep}`) : '';
                  const comp = a.complemento ? `, ${a.complemento}` : '';
                  return [l1, (l1 && l2) ? ' - ' : '', l2, cep, comp].join('').trim();
                };
                io.emitOrderCreated({
                  id: row.id,
                  total: Number(row.total) || 0,
                  created_at: new Date().toISOString(),
                  customer: {
                    name: String(user?.nome || 'Cliente'),
                    phone: String(user?.telefone || ''),
                    address: formatAddr(addrObj)
                  }
                });
              }
            } catch (emitErr) { console.error('Falha ao montar payload emitOrderCreated diferido:', emitErr); }
          }
        }
      } catch(_) {}

  return res.json({ sucesso:true });
    } catch (e) {
      console.error('Webhook InfinitePay erro:', e);
      return res.status(500).json({ sucesso:false });
    }
  }
};
