// Removível: script para criar tabela de produtos e inserir exemplos mínimos
require('dotenv').config();
const { testConnection } = require('../src/config/database');
const Product = require('../src/models/Product');

(async () => {
  try {
    const ok = await testConnection();
    if (!ok) throw new Error('Sem conexão com o banco');

    await Product.createTable();

    // Opcional: inserir 2 itens básicos se tabela estiver vazia
    const existing = await Product.listAll({ onlyActive: false });
    if (!existing || existing.length === 0) {
      await Product.create({
        name: 'Muçarela',
        category: 'pizza',
        description: 'Clássica com muito queijo muçarela e orégano.',
        price: [29.9, 39.9, 49.9],
        img: null,
        status: 'active'
      });
      await Product.create({
        name: 'Refrigerante Lata',
        category: 'drink',
        description: 'Diversos sabores (lata 350ml).',
        price: [0, 0, 6.0],
        img: null,
        status: 'active'
      });
      console.log('✅ Tabela products criada e itens iniciais inseridos.');
    } else {
      console.log('✅ Tabela products já existe e possui itens.');
    }
  } catch (err) {
    console.error('❌ Erro no bootstrap:', err.message);
    process.exit(1);
  }
})();
