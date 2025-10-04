// Mock InfinitePay webhook sender for local testing
// Usage:
//   node scripts/mock_webhook.js --order 123 --amount 59.9 --status paid --txid TX123456
// Notes:
// - amount accepts units (59.9) or cents (5990). The server accepts both.
// - Ensure your backend is running at http://localhost:3000

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const crypto = require('crypto');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

async function main() {
  const { order, amount, status, txid, base } = parseArgs();
  if (!order || !status || !txid) {
    console.log('Missing args. Example:');
    console.log('  node scripts/mock_webhook.js --order 123 --amount 59.9 --status paid --txid DEMO_TX_001');
    process.exit(1);
  }
  const amt = amount ? Number(amount) : 0;
  const ts = Math.floor(Date.now() / 1000);
  const secret = process.env.INFINITEPAY_HMAC_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    console.error('Missing INFINITEPAY_HMAC_SECRET in .env');
    process.exit(1);
  }
  const payloadBase = `${order}|${status}|${amt||''}|${txid}|${ts}`;
  const sig = crypto.createHmac('sha256', secret).update(payloadBase).digest('hex');

  const url = (base || process.env.PUBLIC_BASE_URL || 'http://localhost:3000') + '/api/customer/payment/infinitepay/webhook';
  const body = { order_nsu: Number(order), status, amount: amt, txid, ts, sig };
  console.log('POST', url);
  console.log('body', body);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error('Request failed:', e);
    process.exit(1);
  }
}

main();
