// /api/public/categories
const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');

router.get('/', async (req, res) => {
  try {
    const items = await Category.listPublic();
    res.json({ sucesso: true, data: items });
  } catch (e) {
    console.error('Erro ao listar categorias públicas:', e);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar categorias' });
  }
});

module.exports = router;
