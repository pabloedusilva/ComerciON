// Migration - Create store_settings table
const StoreSettings = require('../../models/StoreSettings');

async function up() {
	await StoreSettings.createTable();
}

module.exports = { up };