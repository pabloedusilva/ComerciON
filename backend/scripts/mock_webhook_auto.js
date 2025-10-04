// Auto webhook tester: picks latest order from DB and sends a signed webhook to local server
// Usage:
//   node scripts/mock_webhook_auto.js
// Optional env overrides: PUBLIC_BASE_URL

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const crypto = require('crypto');
const axios = require('axios').default;
const { pool } = require('../src/config/database');

async function getLatestOrder() {
  const [rows] = await pool.query('SELECT id, total FROM pedido ORDER BY id DESC LIMIT 1');
  return rows && rows[0] ? rows[0] : null;
}

async function main() {
  const order = await getLatestOrder();
  if (!order) {
    console.log('Nenhum pedido encontrado no banco. Crie um pedido primeiro.');
    process.exit(1);
  }

  const orderId = Number(order.id);
  const total = Number(order.total || 0);
  if (!Number.isFinite(total) || total <= 0) {
    console.log(`Pedido #${orderId} tem total inválido (${order.total}).`);
    process.exit(1);
  }

  const txid = 'MOCK_' + Date.now();
  const status = 'paid';
  const amount = total; // enviar em unidades; servidor aceita unidades ou centavos
  const ts = Math.floor(Date.now() / 1000);
  const secret = process.env.INFINITEPAY_HMAC_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    console.error('INFINITEPAY_HMAC_SECRET ausente no .env');
    process.exit(1);
  }
  const base = `${orderId}|${status}|${amount||''}|${txid}|${ts}`;
  const sig = crypto.createHmac('sha256', secret).update(base).digest('hex');

  const url = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000') + '/api/customer/payment/infinitepay/webhook';
  const payload = { order_nsu: orderId, status, amount, txid, ts, sig };
  console.log('Enviando webhook simulado para', url);
  console.log('payload:', payload);

  try {
    const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    console.log('Status:', res.status, res.data);
  } catch (e) {
    if (e.response) {
      console.error('Erro:', e.response.status, e.response.data);
    } else {
      console.error('Falha de requisição:', e.message);
    }
    process.exit(1);
  } finally {
    try { await pool.end(); } catch(_) {}
  }
}

main();
