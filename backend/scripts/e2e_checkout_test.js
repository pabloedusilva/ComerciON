// End-to-end checkout test: verifies open vs closed flow
const base = 'http://localhost:3000';

async function req(path, opts = {}) {
  const res = await fetch(base + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { res, json };
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(base + '/api/health');
      if (r.ok) return true;
    } catch (e) { lastErr = e; }
    await wait(500);
  }
  if (lastErr) throw lastErr;
  throw new Error('Server not ready after timeout');
}

function pickProductAndSize(products) {
  for (const p of products || []) {
    const price = p.price || p.preco || p.prices || []; // tolerate variations
    if (!Array.isArray(price)) continue;
    const idx = price.findIndex(v => Number(v) > 0);
    if (idx !== -1) {
      return { id: p.id || p.product_id || p._id, size: idx, name: p.name || p.nome, price: Number(price[idx]) };
    }
  }
  return null;
}

(async () => {
  console.log('--- Waiting for server readiness ---');
  await waitForServer().catch((e)=>{ console.error('Server not ready:', e); process.exit(1); });
  console.log('--- Step 1: Force manual OPEN ---');
  let { res, json } = await req('/api/admin/store/status', {
    method: 'PUT',
    body: JSON.stringify({ closedNow: false, reason: null, reopenAt: null, isManualMode: true })
  });
  if (!res.ok) { console.error('Failed to update store status (open):', res.status, json); process.exit(1); }

  console.log('--- Step 2: Check public store status ---');
  ;({ res, json } = await req('/api/public/store'));
  if (!res.ok || !json?.sucesso) { console.error('Failed to fetch public store status', res.status, json); process.exit(1); }
  console.log('Store effectiveClosed =', json.data?.effectiveClosed);
  if (json.data?.effectiveClosed) { console.error('Store should be open but effectiveClosed=true'); process.exit(1); }

  // Generate unique test user
  const email = `tester+${Date.now()}@pizzaria.com`;
  const senha = 'Teste123';
  console.log('--- Step 3: Register customer ---');
  ;({ res, json } = await req('/api/customer/auth/registrar', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Tester E2E',
      email,
      senha,
      telefone: '(11) 98888-7777',
      cep: '12345-678'
    })
  }));
  if (!res.ok) {
    console.warn('Registration failed (maybe exists):', res.status, json?.mensagem || json);
  } else {
    console.log('Registered user:', email);
  }

  console.log('--- Step 4: Login customer ---');
  ;({ res, json } = await req('/api/customer/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }));
  if (!res.ok || !json?.sucesso || !json?.token) { console.error('Failed to login customer:', res.status, json); process.exit(1); }
  const token = json.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('Logged in.');

  console.log('--- Step 5: Fetch products ---');
  ;({ res, json } = await req('/api/public/catalog/products'));
  if (!res.ok || !json?.sucesso) { console.error('Failed to fetch products:', res.status, json); process.exit(1); }
  const picked = pickProductAndSize(json.data || json.products || []);
  if (!picked || !picked.id) { console.error('No product with valid price found'); process.exit(1); }
  console.log('Picked product:', picked.name, 'size index:', picked.size, 'price:', picked.price);

  console.log('--- Step 6: Create order (should succeed) ---');
  ;({ res, json } = await req('/api/customer/orders', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      items: [{ id: picked.id, size: picked.size, quantity: 1, removedIngredients: '' }],
      address: {
        nome: 'Tester E2E', telefone: '(11) 98888-7777', endereco: 'Rua Teste', numero: '123', bairro: 'Centro', cidade: 'SP', estado: 'SP', cep: '12345-678'
      }
    })
  }));
  if (!res.ok || !json?.sucesso) { console.error('Order creation failed (open):', res.status, json); process.exit(1); }
  console.log('Order created id =', json.data?.id, 'totals =', json.data?.totals);

  console.log('--- Step 7: Force manual CLOSED ---');
  ;({ res, json } = await req('/api/admin/store/status', {
    method: 'PUT',
    body: JSON.stringify({ closedNow: true, reason: 'Fechado para testes', reopenAt: null, isManualMode: true })
  }));
  if (!res.ok) { console.error('Failed to update store status (closed):', res.status, json); process.exit(1); }

  console.log('--- Step 8: Verify public status closed ---');
  ;({ res, json } = await req('/api/public/store'));
  if (!res.ok || !json?.sucesso) { console.error('Failed to fetch public store after close', res.status, json); process.exit(1); }
  console.log('Store effectiveClosed =', json.data?.effectiveClosed);
  if (!json.data?.effectiveClosed) { console.error('Store should be closed but effectiveClosed=false'); process.exit(1); }

  console.log('--- Step 9: Attempt create order (should be blocked) ---');
  ;({ res, json } = await req('/api/customer/orders', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      items: [{ id: picked.id, size: picked.size, quantity: 1, removedIngredients: '' }]
    })
  }));
  console.log('Closed create order status =', res.status, 'response =', json);
  if (res.status !== 403 || json?.codigo !== 'STORE_CLOSED') {
    console.error('Expected STORE_CLOSED 403 when closed'); process.exit(1);
  }

  console.log('\n✅ E2E checkout test passed.');
  process.exit(0);
})().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
