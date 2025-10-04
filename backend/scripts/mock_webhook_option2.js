// Sends InfinitePay Option 2 webhook payload to local/public server
// Usage:
//   node scripts/mock_webhook_option2.js --order 123 --paid 59.9 --txid TX_ABC --base http://localhost:3000
// Requires INFINITEPAY_WEBHOOK_TOKEN in .env

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const axios = require('axios').default;

function args() {
  const a = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].replace(/^--/, '');
      const v = (a[i+1] && !a[i+1].startsWith('--')) ? a[++i] : 'true';
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  const { order, paid, txid, base } = args();
  if (!order || !txid) {
    console.log('Exemplo: node scripts/mock_webhook_option2.js --order 101 --paid 59.9 --txid MOCK_TX_1');
    process.exit(1);
  }
  const token = process.env.INFINITEPAY_WEBHOOK_TOKEN;
  if (!token) {
    console.error('Defina INFINITEPAY_WEBHOOK_TOKEN no .env');
    process.exit(1);
  }
  const url = (base || process.env.PUBLIC_BASE_URL || 'http://localhost:3000') + '/api/customer/payment/infinitepay/webhook';
  const payload = {
    invoice_slug: 'demo',
    amount: Number(paid || 0),
    paid_amount: Number(paid || 0),
    installments: 1,
    capture_method: 'credit_card',
    transaction_nsu: String(txid),
    order_nsu: String(order),
    receipt_url: 'https://example.com/receipt/123',
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
  }
}

main();
