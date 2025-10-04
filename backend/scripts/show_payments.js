const { pool } = require('../src/config/database');

async function main() {
	try {
		const [rows] = await pool.query('SELECT id, order_id, provider, txid, status, amount, received_at, created_at FROM payments ORDER BY id DESC LIMIT 20');
		if (!rows.length) {
			console.log('No payments found');
		} else {
			console.table(rows);
		}
	} catch (e) {
		console.error('Error querying payments:', e.message);
	} finally {
		try { await pool.end(); } catch(_) {}
		process.exit(0);
	}
}

main();

