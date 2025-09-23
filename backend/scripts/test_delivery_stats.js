 // Temporary smoke test for delivery stats
const { getStats } = require('../src/controllers/admin/deliveryController');

(async () => {
  const req = {};
  const res = {
    json(payload) {
      try {
        console.log(JSON.stringify(payload, null, 2));
      } catch (_) {
        console.log(payload);
      }
      process.exit(0);
    }
  };

  await getStats(req, res);
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
