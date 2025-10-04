// Auto-sends InfinitePay Option 2 webhook using latest order from DB
// Usage:
//   node scripts/mock_webhook_option2_auto.js

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const axios = require('axios').default;
const { pool } = require('../src/config/database');

async function getLatestOrder() {
  const [rows] = await pool.query('SELECT id, total FROM pedido ORDER BY id DESC LIMIT 1');
  return rows && rows[0] ? rows[0] : null;
}

async function main() {
  const order = await getLatestOrder();
  if (!order) {
    console.log('Nenhum pedido encontrado. Crie um pedido antes.');
    process.exit(1);
  }
  const token = process.env.INFINITEPAY_WEBHOOK_TOKEN;
  if (!token) {
    console.error('Defina INFINITEPAY_WEBHOOK_TOKEN no .env');
    process.exit(1);
  }
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const url = base.replace(/\/$/, '') + '/api/customer/payment/infinitepay/webhook';
  const paid = Number(order.total || 0);
  if (!Number.isFinite(paid) || paid <= 0) {
    console.error(`Pedido #${order.id} possui total inválido (${order.total}).`);
    process.exit(1);
  }
  const txid = 'MOCK_' + Date.now();
  const payload = {
    invoice_slug: 'auto',
    amount: paid,
    paid_amount: paid,
    installments: 1,
    capture_method: 'credit_card',
    transaction_nsu: txid,
    order_nsu: String(order.id),
    receipt_url: 'https://example.com/receipt/mock',
    items: []
  };
  console.log('POST', url);
  console.log('payload', payload);
  try {
    const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json', 'x-webhook-token': token } });
    console.log('Status:', res.status, res.data);
  } catch (e) {
    if (e.response) console.error('Erro:', e.response.status, e.response.data);
    else console.error('Falha:', e.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch(_) {}
  }
}

main();
