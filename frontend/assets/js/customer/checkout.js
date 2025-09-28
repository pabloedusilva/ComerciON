// Checkout page logic with strong auth and profile integration
(function(){
  // Bloqueio de acesso: se a loja estiver fechada, redireciona imediatamente ao menu
  (async ()=>{
    try {
      const res = await fetch('/api/public/store', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.sucesso) throw new Error();
      if (json.data && json.data.closedNow === true) {
        try { localStorage.setItem('pizzaria_trigger_closed_modal', '1'); } catch(_) {}
        window.location.href = '/menu?closed=1';
        return; // impede prosseguir
      }
    } catch(_) {
      // Por segurança, se não conseguir verificar, evita acesso
      try { localStorage.setItem('pizzaria_trigger_closed_modal', '1'); } catch(_) {}
      window.location.href = '/menu?closed=1';
      return;
    }
  })();
  const Auth = window.AuthSystem;
  // Early auth gate
  if (!Auth || !Auth.isAuthenticated()) {
    const target = '/checkout';
    window.location.href = '/login?redirect=' + encodeURIComponent(target);
    return;
  }

  const token = Auth.token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  const api = async (url, options={}) => {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    let data = {};
    try { data = await res.json(); } catch(_) {}
    if (!res.ok) throw new Error(data.mensagem || 'Erro de rede');
    return data;
  };

  const money = (v) => Number(v||0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
  const orderItemsEl = document.getElementById('orderItems');

  // Catalog cache for names/images/sizes/prices
  let catalog = { produtos: [], drinks: [], all: [], byId: new Map() };
  async function fetchCatalogOnce(){
    if (catalog.all.length) return catalog;
    try {
      const res = await fetch('/api/public/catalog/products');
      const json = await res.json();
      if (!res.ok || !json.sucesso) throw new Error(json.mensagem || 'Falha ao carregar catálogo');
      const all = Array.isArray(json.data) ? json.data : [];
      catalog.all = all;
      catalog.produtos = all.filter(p => p.category === 'produto');
      catalog.drinks = all.filter(p => p.category === 'drink');
      catalog.byId = new Map(all.map(p => [String(p.id), p]));
    } catch (e) {
      console.warn('Catálogo indisponível:', e.message);
    }
    return catalog;
  }

  // Prefill personal data from profile
  async function prefillFromProfile(){
    try {
      const { usuario } = await api('/api/customer/profile');
      if (usuario) {
        const nomeEl = document.getElementById('nome');
        const telEl = document.getElementById('telefone');
        const emailEl = document.getElementById('email');
        if (nomeEl) nomeEl.value = usuario.nome || '';
        if (telEl) telEl.value = usuario.telefone || '';
        if (emailEl) emailEl.value = usuario.email || '';
        // Address (may be blank)
        const addrMap = {
          cep: usuario.cep,
          endereco: usuario.endereco,
          numero: usuario.numero,
          complemento: usuario.complemento,
          bairro: usuario.bairro,
          cidade: usuario.cidade,
          estado: usuario.estado
        };
        Object.entries(addrMap).forEach(([id, val]) => {
          const el = document.getElementById(id);
          if (el && val) el.value = val;
        });
      }
    } catch (e) {
      // if verification fails, force relogin
      window.location.href = '/login?redirect=' + encodeURIComponent('/checkout');
    }
  }

  // Build order summary from localStorage cart
  async function buildOrderSummary(){
    const cart = JSON.parse(localStorage.getItem('produto_cart') || '[]');
    await fetchCatalogOnce();
    let itemsTotal = 0;
    const entrega = 5;
    orderItemsEl.innerHTML = '';

    if (Array.isArray(cart) && cart.length) {
      cart.forEach(item => {
        const prod = catalog.byId.get(String(item.id));
        const unitPrice = prod && Array.isArray(prod.price) ? Number(prod.price[item.size || 0] || item.price || 0) : Number(item.price || 0);
        const price = unitPrice * (item.qt || 1);
        itemsTotal += price;
        const sizeText = prod && Array.isArray(prod.sizes) && typeof item.size === 'number' ? (prod.sizes[item.size] || '') : '';
        const removed = item.removedIngredients ? `<br><small style=\"color:#999;\">Sem: ${item.removedIngredients}</small>` : '';
        const displayName = prod && prod.name ? `${prod.name}${sizeText ? ` (${sizeText})` : ''}${removed}` : `Item ${item.id}${sizeText ? ` (${sizeText})` : ''}${removed}`;
        const imgUrl = (prod && prod.img) ? prod.img : '/assets/images/default-images/produto-padrao.png';
        const row = document.createElement('div');
        row.className = 'order-item';
        row.innerHTML = `
          <img src=\"${imgUrl}\" alt=\"item\">
          <div>
            <div class=\"name\">${displayName}</div>
            <div class="details">Qtd: ${item.qt || 1}</div>
          </div>
          <div class="qty">${money(price)}</div>
        `;
        orderItemsEl.appendChild(row);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'order-item';
      empty.innerHTML = '<div class="name">Seu carrinho está vazio.</div>';
      orderItemsEl.appendChild(empty);
    }

    const subtotal = itemsTotal + entrega;
    const desconto = subtotal * 0.1;
    const total = subtotal - desconto;

    document.getElementById('resumoItens').textContent = money(itemsTotal);
    document.getElementById('resumoEntrega').textContent = money(entrega);
    document.getElementById('resumoSubtotal').textContent = money(subtotal);
    document.getElementById('resumoDesconto').textContent = money(desconto);
    document.getElementById('resumoTotal').textContent = money(total);
  }

  // Guard: empty cart → back to menu checkout section
  function enforceCartNotEmpty(){
    const cart = JSON.parse(localStorage.getItem('produto_cart') || '[]');
    if (!Array.isArray(cart) || cart.length === 0) {
      window.location.href = '/menu#checkout';
      return false;
    }
    return true;
  }

  // Stepper logic mirroring temp script with small adjustments
  const steps = Array.from(document.querySelectorAll('.stepper .step'));
  const connectors = Array.from(document.querySelectorAll('.stepper .connector'));
  let activeStep = 1;
  function markCompleted(upTo){
    steps.forEach(s=>{
      const n = Number(s.getAttribute('data-step'));
      s.classList.toggle('completed', n < upTo);
    });
    connectors.forEach((c, idx)=> c.classList.toggle('completed', upTo >= (idx+2)) );
  }
  function setActiveStep(n){
    activeStep = n;
    const target = String(n);
    document.querySelectorAll('[data-step-content]').forEach(c=>{
      const show = c.getAttribute('data-step-content')===target;
      if (show) c.removeAttribute('hidden'); else c.setAttribute('hidden','');
    });
    steps.forEach(s=>{
      const isActive = s.getAttribute('data-step')===target;
      s.classList.toggle('active', isActive);
      s.setAttribute('aria-current', isActive ? 'step' : 'false');
    });
    markCompleted(n);
  }
  // Always reset to step 1 on entry for safety
  setActiveStep(1);

  const requiredPersonal = ['nome','telefone','email'];
  const requiredAddress = ['cep','endereco','numero','bairro','cidade','estado'];
  const isPersonalValid = () => requiredPersonal.every(id=> (document.getElementById(id)?.value||'').trim());
  const isAddressValid = () => requiredAddress.every(id=> (document.getElementById(id)?.value||'').trim());

  const step2Btn = steps.find(s=>s.getAttribute('data-step')==='2');
  const step3Btn = steps.find(s=>s.getAttribute('data-step')==='3');
  function updateStepEnables(){
    if (step2Btn) { if (isPersonalValid()) step2Btn.removeAttribute('disabled'); else step2Btn.setAttribute('disabled',''); }
    if (step3Btn) { if (isAddressValid()) step3Btn.removeAttribute('disabled'); else step3Btn.setAttribute('disabled',''); }
  }

  function clearErrors(ids){ ids.forEach(id => document.getElementById(id)?.classList.remove('field-error')); }
  function markErrors(ids){
    let first = null;
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const val = (el.value || '').trim();
      el.classList.toggle('field-error', !val);
      if (!val && !first) first = el;
    });
    if (first && typeof first.scrollIntoView === 'function') {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { first.focus({ preventScroll: true }); } catch(_) { try { first.focus(); } catch(_) {} }
    }
  }

  document.getElementById('goStep2').addEventListener('click', ()=>{
    clearErrors(requiredPersonal);
    if (!isPersonalValid()) { markErrors(requiredPersonal); return; }
    setActiveStep(2);
  });
  document.getElementById('backToStep1').addEventListener('click', ()=> setActiveStep(1));

  document.getElementById('goStep3').addEventListener('click', async ()=>{
    clearErrors(requiredAddress);
    if (!isAddressValid()) { markErrors(requiredAddress); return; }
    // Persist address if missing in profile
    try {
      const payload = {
        nome: document.getElementById('nome').value.trim(),
        telefone: document.getElementById('telefone').value.trim(),
        endereco: document.getElementById('endereco').value.trim(),
        numero: (document.getElementById('numero')?.value || '').trim(),
        complemento: (document.getElementById('complemento')?.value || '').trim(),
        bairro: (document.getElementById('bairro')?.value || '').trim(),
        cidade: document.getElementById('cidade').value.trim(),
        estado: document.getElementById('estado').value.trim().toUpperCase(),
        cep: document.getElementById('cep').value.trim()
      };
      await api('/api/customer/profile', { method: 'PUT', body: JSON.stringify(payload) });
    } catch(_) {}
    // Salvar endereço completo do checkout para usar na criação do pedido
    try {
      const addr = {
        nome: document.getElementById('nome').value.trim(),
        telefone: document.getElementById('telefone').value.trim(),
        endereco: document.getElementById('endereco').value.trim(),
        numero: document.getElementById('numero').value.trim(),
        complemento: document.getElementById('complemento').value.trim(),
        bairro: document.getElementById('bairro').value.trim(),
        cidade: document.getElementById('cidade').value.trim(),
        estado: document.getElementById('estado').value.trim().toUpperCase(),
        cep: sanitizeCEP(document.getElementById('cep').value.trim())
      };
      localStorage.setItem('checkout_address', JSON.stringify(addr));
    } catch(_) {}
    setActiveStep(3);
    buildOrderSummary();
  });
  document.getElementById('backToStep2').addEventListener('click', ()=> setActiveStep(2));

  // Live validation
  [...requiredPersonal, ...requiredAddress].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateStepEnables);
  });

  // CEP auto-fill
  const cepInput = document.getElementById('cep');
  const cepError = document.getElementById('cepError');
  const buscarCepBtn = document.getElementById('buscarCep');
  const sanitizeCEP = (v) => (v||'').replace(/\D/g,'').slice(0,8);
  const maskCEP = (v) => { const s = sanitizeCEP(v); return s.length>5 ? s.slice(0,5)+'-'+s.slice(5) : s; };
  async function fetchCEP(cep){
    if (!cep || cep.length !== 8) return;
    cepError.textContent = '';
    buscarCepBtn.classList.add('loading');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const json = await res.json();
      if (json.erro) { cepError.textContent = 'CEP não encontrado.'; return; }
      document.getElementById('endereco').value = json.logradouro || '';
      document.getElementById('bairro').value = json.bairro || '';
      document.getElementById('cidade').value = json.localidade || '';
      document.getElementById('estado').value = json.uf || '';
    } catch (e) { cepError.textContent = 'Não foi possível buscar o CEP.'; }
    finally { buscarCepBtn.classList.remove('loading'); }
  }
  cepInput.addEventListener('input', (e)=>{
    const masked = maskCEP(e.target.value);
    e.target.value = masked;
    const clean = sanitizeCEP(masked);
    if (clean.length === 8) fetchCEP(clean);
    updateStepEnables();
  });
  buscarCepBtn.addEventListener('click', ()=> fetchCEP(sanitizeCEP(cepInput.value)) );

  // Step header nav guards
  steps.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const stepNum = Number(btn.getAttribute('data-step'));
      if (btn.hasAttribute('disabled')) return;
      if (stepNum===2 && !isPersonalValid()) { clearErrors(requiredPersonal); markErrors(requiredPersonal); return; }
      if (stepNum===3 && (!isPersonalValid() || !isAddressValid())) { 
        clearErrors([...requiredPersonal, ...requiredAddress]);
        if (!isPersonalValid()) markErrors(requiredPersonal);
        else markErrors(requiredAddress);
        return; 
      }
      if (stepNum===3) buildOrderSummary();
      setActiveStep(stepNum);
    });
  });

  // Initialize
  if (!enforceCartNotEmpty()) return;
  prefillFromProfile().then(()=>{
    updateStepEnables();
  });

  // Re-guard and reset if user navigates back/forward
  window.addEventListener('pageshow', (e)=>{
    if (e.persisted) {
      if (!enforceCartNotEmpty()) return;
      setActiveStep(1);
      updateStepEnables();
    }
  });

  // Proteção de finalização: bloquear quando loja fechada e exibir modal
  async function fetchStoreStatus(){
    try {
      const res = await fetch('/api/public/store', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.sucesso) throw new Error(json.mensagem || 'Falha ao verificar status');
      return json.data || {};
    } catch (e) {
      // Em caso de falha, considerar fechado (segurança em primeiro lugar)
      return { closedNow: true };
    }
  }

  function showClosedModal(msg, reopenAt){
    const area = document.getElementById('storeClosedModal');
    if (!area) { alert(msg || 'Estamos fechados no momento.'); return; }
    const p = document.getElementById('storeClosedMsg');
    const parts = [];
    if (msg) parts.push(String(msg));
    if (reopenAt) {
      try {
        const d = new Date(reopenAt);
        if (!isNaN(d)) {
          const f = d.toLocaleString('pt-BR');
          parts.push(`Previsão de reabertura: ${f}`);
        }
      } catch(_) {}
    }
    p.textContent = parts.join(' — ') || 'Volte mais tarde para finalizar seu pedido.';
    area.style.display = 'flex';
    const close = ()=> { area.style.display = 'none'; };
    document.getElementById('storeClosedOk')?.addEventListener('click', close, { once: true });
    // Fechar clicando fora
    area.addEventListener('click', (e)=>{ if (e.target === area) close(); }, { once: true });
  }

  const goPayment = document.getElementById('goPayment');
  if (goPayment) {
    goPayment.addEventListener('click', async (e)=>{
      // Sempre intercepta para verificar status primeiro
      e.preventDefault();
      e.stopImmediatePropagation?.();
      const status = await fetchStoreStatus();
      if (status && (status.closedNow === true)) {
        showClosedModal(status.reason, status.reopenAt);
        return false;
      }
      // Aberto => permitir seguir para pagamento
      window.location.href = '/payment';
      return true;
    }, { capture: true });
  }
})();
