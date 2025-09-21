// /api/public/catalog
const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');

// GET /api/public/catalog/products
router.get('/products', async (req, res) => {
	try {
		const items = await Product.listAll({ onlyActive: true });
		res.json({ sucesso: true, data: items });
	} catch (error) {
		console.error('Erro ao listar catálogo:', error);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar catálogo' });
	}
});

module.exports = router;