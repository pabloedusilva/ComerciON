// /api/customer/orders
const express = require('express');
const router = express.Router();
const { autenticarCliente } = require('../../middleware/auth');
const { sanitizarEntrada } = require('../../middleware/validation');
const rateLimit = require('express-rate-limit');
const ctrl = require('../../controllers/customer/ordersController');
const checkStoreOpen = require('../../middleware/storeOpen');
const PDFDocument = require('pdfkit');

const limitePedidos = rateLimit({ windowMs: 60 * 1000, max: process.env.NODE_ENV==='production'? 60: 600 });

router.use(sanitizarEntrada);
router.use(limitePedidos);

router.get('/', autenticarCliente, ctrl.list);
router.get('/:id', autenticarCliente, ctrl.getById);
router.post('/', autenticarCliente, checkStoreOpen, ctrl.create);

// Recibo PDF Moderno - Sistema Organizado de Comprovantes
router.get('/:id/receipt', autenticarCliente, async (req, res) => {
	try {
		const userId = req.usuario.id;
		const id = parseInt(req.params.id, 10);
		if (!id) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });

		const { pool } = require('../../config/database');
		
		// Buscar pedido com validação de segurança
		const [[order]] = await pool.query(
			'SELECT id, user_id, subtotal, delivery_fee, discount, total, status, created_at, address_json FROM pedido WHERE id = ? AND user_id = ?', 
			[id, userId]
		);
		if (!order) return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado' });

		// Buscar dados de pagamento completos
		let payment = null;
		try {
			const [pays] = await pool.query(
				'SELECT txid, status, amount, received_at FROM payments WHERE order_id = ? ORDER BY received_at DESC LIMIT 1', 
				[id]
			);
			if (pays && pays[0]) {
				payment = {
					txid: String(pays[0].txid || ''),
					status: String(pays[0].status || ''),
					amount: Number(pays[0].amount) || 0,
					received_at: pays[0].received_at
				};
			}
		} catch(_) {}

		// Buscar itens detalhados com nomes preservados e preços para determinar tamanho único
		const [items] = await pool.query(
			`SELECT i.name_snapshot, i.size, i.quantity, i.unit_price, i.removed_ingredients,
					p.name AS product_name, p.category, p.price_small, p.price_medium, p.price_large
			 FROM pedido_itens i 
			 LEFT JOIN products p ON p.id = i.product_id 
			 WHERE i.order_id = ?`,
			[id]
		);

		// Buscar configurações da loja e layout
		let storeSettings = null;
		let layoutSettings = null;
		
		try {
			const Settings = require('../../models/Settings');
			storeSettings = await Settings.get();
		} catch(err) {
			console.log('Erro ao buscar settings:', err.message);
		}

		try {
			const Layout = require('../../models/Layout');
			layoutSettings = await Layout.get();
		} catch(err) {
			console.log('Erro ao buscar layout:', err.message);
		}

		// Preparar dados completos para o gerador de PDF
		const orderData = {
			...order,
			payment,
			items: items.map(item => {
				// Usar a mesma lógica do ordersController para determinar size_name corretamente
				const s = Number(item.size);
				const pricesArr = [
					Number(item.price_small || 0), 
					Number(item.price_medium || 0), 
					Number(item.price_large || 0)
				];
				const nonZero = pricesArr.filter(v => v > 0).length;
				const isUnique = nonZero === 1;
				const sizeMap = ['P', 'M', 'G'];
				const size_name = isUnique ? 'Tamanho Único' : (sizeMap[s] || null);
				
				return {
					...item,
					product_name: item.product_name || item.name_snapshot || 'Item',
					size_name,
					price: Number(item.unit_price) || 0,
					quantity: Number(item.quantity) || 1
				};
			})
		};

		// Usar o serviço moderno de geração de PDF
		const pdfGenerator = require('../../services/pdfReceiptGenerator');
		const inline = String(req.query.inline || '').toLowerCase() === '1' || String(req.query.view || '').toLowerCase() === '1';
		
		await pdfGenerator.generateModernReceipt(orderData, storeSettings, layoutSettings, res, inline);

	} catch (error) {
		console.error('Erro ao gerar comprovante:', error);
		if (!res.headersSent) {
			return res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar comprovante' });
		}
	}
});

module.exports = router;