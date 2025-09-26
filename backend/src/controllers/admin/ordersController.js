const { pool } = require('../../config/database');

// Mapear diversos valores (ingles/portugues) para os finais em português
const STATUS_MAP_TO_PT = {
	// inglês
	paid: 'pendente',
	pending: 'pendente',
	preparing: 'preparando',
	delivering: 'a_caminho',
	delivery: 'a_caminho',
	delivered: 'entregue',
	canceled: 'cancelado',
	cancelled: 'cancelado',
	// português (já corretos)
	pendente: 'pendente',
	preparando: 'preparando',
	a_caminho: 'a_caminho',
	'a caminho': 'a_caminho',
	entregue: 'entregue',
	cancelado: 'cancelado'
};
const STATUS_ALLOWED = ['pendente','preparando','a_caminho','entregue','cancelado'];

function normalizeToPt(s){
	return STATUS_MAP_TO_PT[String(s || '').toLowerCase()] || 'pendente';
}

module.exports = {
	// GET /api/admin/orders
	list: async (req, res) => {
		try {
			const [orders] = await pool.query(`
				SELECT p.id, p.status, p.total, p.created_at, p.address_json,
					   u.nome, u.telefone,
					   u.endereco AS u_endereco, u.numero AS u_numero, u.bairro AS u_bairro,
					   u.cidade AS u_cidade, u.estado AS u_estado, u.cep AS u_cep
				FROM pedido p
				JOIN usuarios u ON u.id = p.user_id
				ORDER BY p.created_at DESC
				LIMIT 500
			`);
			const ids = orders.map(o => o.id);
			let itemsByOrder = {};
			if (ids.length) {
				const [items] = await pool.query(`
					SELECT i.order_id, i.product_id, i.category, i.size, i.quantity, i.unit_price, pr.name
					FROM pedido_itens i
					JOIN products pr ON pr.id = i.product_id
					WHERE i.order_id IN (${ids.map(()=>'?').join(',')})
				`, ids);
				for (const it of items) {
					(itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(it);
				}
			}
			const formatAddr = (a) => {
				if (!a || typeof a !== 'object') return '';
				const parts = [];
				if (a.endereco) parts.push(a.endereco);
				if (a.numero) parts.push(`, ${a.numero}`);
				if (a.bairro) parts.push(` - ${a.bairro}`);
				const line1 = parts.join('');
				const parts2 = [];
				if (a.cidade) parts2.push(a.cidade);
				if (a.estado) parts2.push(a.estado);
				const line2 = parts2.length ? `${parts2.join('/')} ` : '';
				const cep = a.cep ? `CEP: ${a.cep}` : '';
				const comp = a.complemento ? `, ${a.complemento}` : '';
				return [line1, (line1 && (line2 || cep)) ? ' - ' : '', line2, cep, comp].join('').trim();
			};
			const data = orders.map(o => {
				let addrObj = null;
				try { addrObj = JSON.parse(o.address_json || 'null'); } catch(_) { addrObj = null; }
				// Fallback para dados do perfil do usuário quando não houver snapshot
				const fallbackAddr = (!addrObj || Object.keys(addrObj||{}).length === 0) ? {
					endereco: o.u_endereco || null,
					numero: o.u_numero || null,
					bairro: o.u_bairro || null,
					cidade: o.u_cidade || null,
					estado: (o.u_estado || null),
					cep: o.u_cep || null
				} : null;
				const enderecoFormatado = addrObj ? (formatAddr(addrObj) || addrObj.endereco || '') : formatAddr(fallbackAddr);
				return {
					id: o.id,
					status: normalizeToPt(o.status),
					total: Number(o.total),
					data: o.created_at,
					cliente: o.nome,
					telefone: o.telefone || '',
					endereco: enderecoFormatado || '',
					items: (itemsByOrder[o.id]||[]).map(it=>({ nome: it.name, quantidade: it.quantity, preco: Number(it.unit_price) }))
				};
			});
			return res.json({ sucesso: true, data });
		} catch (e) {
			console.error('Erro list orders:', e);
			return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar pedidos' });
		}
	},

	// GET /api/admin/orders/:id
	getById: async (req, res) => {
		try {
			const id = parseInt(req.params.id, 10);
			if (Number.isNaN(id)) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
			const [[order]] = await pool.query(`
				SELECT p.id, p.status, p.subtotal, p.delivery_fee, p.discount, p.total, p.address_json, p.created_at, u.nome, u.telefone
				FROM pedido p
				JOIN usuarios u ON u.id = p.user_id
				WHERE p.id = ?
			`, [id]);
			if (!order) return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado' });
			const [items] = await pool.query(`
				SELECT i.product_id, pr.name, i.category, i.size, i.quantity, i.unit_price
				FROM pedido_itens i JOIN products pr ON pr.id = i.product_id
				WHERE i.order_id = ?
			`, [id]);
			const addr = (()=>{ try { return JSON.parse(order.address_json||'null'); } catch(_) { return null; } })();
			const formatAddr = (a) => {
				if (!a || typeof a !== 'object') return '';
				const parts = [];
				if (a.endereco) parts.push(a.endereco);
				if (a.numero) parts.push(`, ${a.numero}`);
				if (a.bairro) parts.push(` - ${a.bairro}`);
				const line1 = parts.join('');
				const parts2 = [];
				if (a.cidade) parts2.push(a.cidade);
				if (a.estado) parts2.push(a.estado);
				const line2 = parts2.length ? `${parts2.join('/')}` : '';
				const cep = a.cep ? `, CEP: ${a.cep}` : '';
				const comp = a.complemento ? `, ${a.complemento}` : '';
				return [line1, (line1 && line2) ? ' - ' : '', line2, cep, comp].join('').trim();
			};
			return res.json({ sucesso: true, data: {
				id: order.id,
				status: normalizeToPt(order.status),
				totals: { subtotal: Number(order.subtotal), entrega: Number(order.delivery_fee), desconto: Number(order.discount), total: Number(order.total) },
				data: order.created_at,
				cliente: order.nome,
				telefone: order.telefone || '',
				address: addr,
				formattedAddress: formatAddr(addr),
				items: items.map(it=>({ nome: it.name, quantidade: it.quantity, preco: Number(it.unit_price), size: it.size, category: it.category }))
			}});
		} catch (e) {
			console.error('Erro get order:', e);
			return res.status(500).json({ sucesso: false, mensagem: 'Erro ao obter pedido' });
		}
	},

	// PUT /api/admin/orders/:id/status
	updateStatus: async (req, res) => {
		try {
			const id = parseInt(req.params.id, 10);
			const status = String(req.body?.status || '').toLowerCase();
			if (Number.isNaN(id)) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
			if (!STATUS_ALLOWED.includes(status)) return res.status(400).json({ sucesso: false, mensagem: 'Status inválido' });
			const [r] = await pool.query('UPDATE pedido SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
			if (r.affectedRows === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado' });

			// Emitir atualização em tempo real para admins conectados
			try {
				const io = req.app?.get('io');
				if (io && typeof io.emitOrderUpdated === 'function') {
					io.emitOrderUpdated({ id, status });
				}
			} catch (_) { /* noop */ }
			return res.json({ sucesso: true, mensagem: 'Status atualizado' });
		} catch (e) {
			console.error('Erro update status:', e);
			return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar status' });
		}
	}
};