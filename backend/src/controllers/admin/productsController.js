const Product = require('../../models/Product');

const productsController = {
	async list(req, res) {
		try {
			const items = await Product.listAll({ onlyActive: false });
			res.json({ sucesso: true, data: items });
		} catch (error) {
			console.error('Erro ao listar produtos:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar produtos' });
		}
	},

	async create(req, res) {
		try {
			const { name, category, description, price, img, status } = req.body;
			if (!name || !category || !price) {
				return res.status(400).json({ sucesso: false, mensagem: 'Campos obrigatórios ausentes' });
			}
			const created = await Product.create({ name, category, description, price, img, status });
			res.status(201).json({ sucesso: true, data: created });
		} catch (error) {
			console.error('Erro ao criar produto:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar produto' });
		}
	},

	async update(req, res) {
		try {
			const id = parseInt(req.params.id);
			const { name, category, description, price, img, status } = req.body;
			const updated = await Product.update(id, { name, category, description, price, img, status });
			if (!updated) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado' });
			res.json({ sucesso: true, data: updated });
		} catch (error) {
			console.error('Erro ao atualizar produto:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar produto' });
		}
	},

	async remove(req, res) {
		try {
			const id = parseInt(req.params.id);
			const ok = await Product.remove(id);
			if (!ok) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado' });
			res.json({ sucesso: true });
		} catch (error) {
			console.error('Erro ao remover produto:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover produto' });
		}
	}
};

module.exports = productsController;