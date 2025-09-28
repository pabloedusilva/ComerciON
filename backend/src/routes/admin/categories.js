// /api/admin/categories
const express = require('express');
const router = express.Router();
const { autenticarAdmin } = require('../../middleware/auth');
const { body, validationResult } = require('express-validator');
const Category = require('../../models/Category');

const validar = [
	body('slug').optional().isString().isLength({ min: 1, max: 50 }),
	body('title').isString().isLength({ min: 2, max: 100 }),
	body('position').optional().isInt({ min: 0, max: 1000 }),
	body('active').optional().isBoolean(),
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos', erros: errors.array() });
		}
		next();
	}
];

router.get('/', autenticarAdmin, async (req, res) => {
	try {
		const items = await Category.listAll();
		res.json({ sucesso: true, data: items });
	} catch (e) {
		console.error('Erro ao listar categorias:', e);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar categorias' });
	}
});

router.post('/', autenticarAdmin, validar, async (req, res) => {
	try {
		const { slug, title, position, active } = req.body;
		const created = await Category.create({ slug, title, position, active });
		res.status(201).json({ sucesso: true, data: created });
	} catch (e) {
		const msg = e && e.message ? e.message : 'Erro ao criar categoria';
		const code = /duplicat/i.test(String(e && e.message)) ? 409 : 500;
		res.status(code).json({ sucesso: false, mensagem: msg });
	}
});

router.put('/:slug', autenticarAdmin, validar, async (req, res) => {
	try {
		const updated = await Category.update(req.params.slug, req.body || {});
		if (!updated) return res.status(404).json({ sucesso: false, mensagem: 'Categoria não encontrada' });
		res.json({ sucesso: true, data: updated });
	} catch (e) {
		console.error('Erro ao atualizar categoria:', e);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar categoria' });
	}
});

router.delete('/:slug', autenticarAdmin, async (req, res) => {
	try {
		const ok = await Category.remove(req.params.slug);
		if (!ok) return res.status(404).json({ sucesso: false, mensagem: 'Categoria não encontrada' });
		res.json({ sucesso: true });
	} catch (e) {
		console.error('Erro ao remover categoria:', e);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover categoria' });
	}
});

module.exports = router;
