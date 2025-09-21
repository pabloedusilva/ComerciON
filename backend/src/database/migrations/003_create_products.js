// Migration - Create products table (removível depois de executar)
const Product = require('../../models/Product');

async function up() {
	await Product.createTable();
}

module.exports = { up };