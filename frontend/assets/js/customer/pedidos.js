(function(){
  const Auth = window.AuthSystem;
  if (!Auth || !Auth.isAuthenticated()) {
    window.location.href = '/login?redirect=' + encodeURIComponent('/pedidos');
    return;
  }

  const token = Auth.token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const money = (v) => Number(v||0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
  const fmtDate = (s) => {
    try { return new Date(s).toLocaleString('pt-BR'); } catch(_) { return s; }
  };

  const listEl = document.getElementById('ordersList');
  const emptyEl = document.getElementById('ordersEmpty');
  const statusText = {
    pendente: 'Pendente',
    preparando: 'Preparando',
    a_caminho: 'A caminho',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  // ================== State para avaliações ==================
  const reviewedOrders = new Set(); // pedidos já avaliados (ids)
  const orderRatings = new Map();    // order_id -> rating numérico
  const promptedOrders = new Set(JSON.parse(localStorage.getItem('review_prompted_orders') || '[]')); // pedidos para os quais já mostramos modal
  let currentOrders = []; // cache última lista para detectar transições

  async function loadUserReviews(){
    try {
      const res = await fetch('/api/customer/reviews', { headers });
      const json = await res.json().catch(()=>({}));
      if (res.ok && json.sucesso && Array.isArray(json.data)) {
        reviewedOrders.clear(); orderRatings.clear();
        json.data.forEach(r => {
          const oid = Number(r.order_id);
          reviewedOrders.add(oid);
          orderRatings.set(oid, Number(r.rating) || 0);
        });
      }
    } catch(_) { /* silencioso */ }
  }

  function persistPrompted(){
    try { localStorage.setItem('review_prompted_orders', JSON.stringify(Array.from(promptedOrders))); } catch(_) {}
  }

  function didBecomeDelivered(prevList, newList){
    const prevStatus = {};
    prevList.forEach(o => prevStatus[o.id] = o.status);
    const transitions = [];
    newList.forEach(o => {
      const oldSt = prevStatus[o.id];
      if (oldSt && oldSt !== 'entregue' && o.status === 'entregue') transitions.push(o);
    });
    return transitions;
  }

  function render(orders){
    if (!Array.isArray(orders) || orders.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    listEl.innerHTML = orders.map(o=>{
      const items = Array.isArray(o.items) ? o.items : [];
      const resumo = items.map(it=> `${it.quantity}x ${it.category==='produto'?'Produto':'Bebida'} ${['320g','530g','860g'][it.size]||''}`).join(', ');
      const st = String(o.status || '').toLowerCase();
      const fmtAddr = (()=>{
        if (o.formattedAddress && typeof o.formattedAddress === 'string') return o.formattedAddress;
        const a = o.address || (function(){ try { return JSON.parse(o.address_json||'null'); } catch(_) { return null; } })();
        if (!a) return '';
        const p1 = [];
        if (a.endereco) p1.push(a.endereco);
        if (a.numero) p1.push(', ' + a.numero);
        if (a.bairro) p1.push(' - ' + a.bairro);
        const l1 = p1.join('');
        const p2 = [];
        if (a.cidade) p2.push(a.cidade);
        if (a.estado) p2.push(a.estado);
        const l2 = p2.length ? p2.join('/') : '';
        const cep = a.cep ? (l2 ? ', CEP: ' + a.cep : 'CEP: ' + a.cep) : '';
        const comp = a.complemento ? ', ' + a.complemento : '';
        return [l1, (l1 && l2) ? ' - ' : '', l2, cep, comp].join('');
      })();
      const addrObj = o.address || (function(){ try { return JSON.parse(o.address_json||'null'); } catch(_) { return null; } })();
      const numeroBairro = (addrObj && (addrObj.numero || addrObj.bairro))
     ? `<div class="order-address order-address-extra">
       <i class="fas fa-info-circle" aria-hidden="true"></i>
             <span>${addrObj.numero ? 'Número: ' + addrObj.numero : ''}${addrObj.numero && addrObj.bairro ? ' • ' : ''}${addrObj.bairro ? 'Bairro: ' + addrObj.bairro : ''}</span>
           </div>`
        : '';
      const alreadyReviewed = reviewedOrders.has(o.id);
      const ratingVal = orderRatings.get(o.id) || 0;
      const canReview = st === 'entregue' && !alreadyReviewed;
      return `
        <div class="order-card" data-order-id="${o.id}">
          <div class="order-header">
            <div class="order-header-left">
              <span class="order-id">#${o.id}</span>
            </div>
            <div class="order-header-right">
              <span class="order-status ${st}">${statusText[st] || '—'}</span>
            </div>
          </div>
          <div class="order-body">
            <div class="order-items">${resumo || 'Itens indisponíveis'}</div>
            <div class="order-total">Total: <strong>${money(o.total)}</strong></div>
            <div class="order-date">${fmtDate(o.created_at)}</div>
            ${alreadyReviewed ? `<div class="order-rating" aria-label="Avaliação: ${ratingVal} de 5">${[1,2,3,4,5].map(i=>`<i class='fas fa-star ${i<=ratingVal?'filled':''}'></i>`).join('')}<span class="sr-only">${ratingVal} estrelas</span></div>` : ''}
          </div>
          ${fmtAddr ? `<div class="order-address"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> <span>${fmtAddr}</span></div>` : ''}
          ${numeroBairro}
          ${canReview ? `<div class="order-review-action"><button class="btn-review btn-review-min" data-order-id="${o.id}" aria-label="Avaliar Pedido #${o.id}"><i class="fas fa-star"></i><span>Avaliar</span></button></div>` : ''}
        </div>
      `;
    }).join('');
    bindReviewButtons();
  }

  async function load(){
    try {
      const res = await fetch('/api/customer/orders', { headers });
      const json = await res.json();
      if (!res.ok || !json.sucesso) throw new Error(json.mensagem || 'Erro');
      const data = json.data || [];
      // detectar transições antes de sobrescrever cache
      const transitions = didBecomeDelivered(currentOrders, data);
      currentOrders = data.map(o => ({ id: o.id, status: String(o.status || '').toLowerCase() }));
      render(data);
      if (typeof adjustPollingStrategy === 'function') {
        try { adjustPollingStrategy(data); } catch(_) {}
      }
      // Se algum pedido acabou de virar entregue => abrir modal (primeiro que não foi avaliado nem prompted)
      for (const ord of transitions) {
        if (!reviewedOrders.has(ord.id) && !promptedOrders.has(ord.id)) {
          promptedOrders.add(ord.id);
          persistPrompted();
          openRatingModal(ord.id);
          break; // abre só um de cada vez
        }
      }
      document.body.classList.add('data-ready');
    } catch(e){
      console.warn('Falha ao carregar pedidos:', e.message);
      listEl.innerHTML = '<div class="order-card"><div class="order-body">Erro ao carregar seus pedidos.</div></div>';
    }
  }

  // Inicialização sequencial segura
  (async () => {
    await loadUserReviews();
    await load();
    startPolling();
    initRealtime();
  })();

  // ================== Reviews ==================
  function bindReviewButtons(){
    document.querySelectorAll('.btn-review').forEach(btn=>{
      btn.addEventListener('click', ()=> openRatingModal(parseInt(btn.dataset.orderId,10)));
    });
  }

  function markReviewed(orderId){
    const oid = Number(orderId);
    reviewedOrders.add(oid);
    // re-render para remover botão rapidamente
    try {
      // Se tivermos a lista atual em cache, forçamos um render rápido
      if (Array.isArray(currentOrders) && currentOrders.length) {
        // precisamos da lista completa; como mantemos apenas id/status em currentOrders,
        // fazemos um reload leve mesmo assim.
        load();
      } else {
        load();
      }
    } catch(_) {}
  }

  // ===== Novo modal com o mesmo estilo do menu =====
  let ratingState = { value: 0, inited: false, orderId: null };

  function openRatingModal(orderId){
    ratingState.orderId = orderId;
    const ratingArea = document.querySelector('.rating.modalArea');
    if (!ratingArea) return;
    // Reset visual
    ratingState.value = 0;
    document.querySelectorAll('.rating-stars .star').forEach(s => {
      s.classList.remove('active','fa-solid');
      s.classList.add('fa-regular');
      s.setAttribute('aria-checked','false');
    });
    const ta = document.getElementById('ratingComment');
    if (ta) ta.value = '';
    const submitBtn = document.getElementById('ratingSubmit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviar avaliação'; }
    const successAnim = document.getElementById('ratingSuccessAnimation');
    if (successAnim) successAnim.classList.remove('show');

    // Abrir modal
    ratingArea.style.opacity = 0;
    ratingArea.style.display = 'flex';
    setTimeout(()=>{ ratingArea.style.opacity = 1; }, 200);

    initRatingInteractionsOnce();
  }

  function closeRatingModal(){
    const ratingArea = document.querySelector('.rating.modalArea');
    if (!ratingArea) return;
    const successAnim = document.getElementById('ratingSuccessAnimation');
    if (successAnim) successAnim.classList.remove('show');
    ratingArea.style.opacity = 0;
    setTimeout(()=>{ ratingArea.style.display = 'none'; }, 200);
  }

  function showRatingSuccessAnimation(){
    const successAnim = document.getElementById('ratingSuccessAnimation');
    if (successAnim) successAnim.classList.add('show');
  }

  function initRatingInteractionsOnce(){
    if (ratingState.inited) return; ratingState.inited = true;
    // Estrelas
    document.querySelectorAll('.rating-stars .star').forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.getAttribute('data-value')) || 0;
        ratingState.value = val;
        document.querySelectorAll('.rating-stars .star').forEach(s => {
          const sVal = parseInt(s.getAttribute('data-value')) || 0;
          const active = sVal <= val;
          s.classList.toggle('active', active);
          if (active) { s.classList.remove('fa-regular'); s.classList.add('fa-solid'); }
          else { s.classList.add('fa-regular'); s.classList.remove('fa-solid'); }
          s.setAttribute('aria-checked', active ? 'true' : 'false');
        });
        const submitBtn = document.getElementById('ratingSubmit');
        if (submitBtn) submitBtn.disabled = ratingState.value === 0;
      });
      star.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); star.click(); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault();
          const next = Math.min(5, (ratingState.value||0) + 1); document.querySelector(`.rating-stars .star[data-value="${next}"]`)?.click(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault();
          const prev = Math.max(1, (ratingState.value||1) - 1); document.querySelector(`.rating-stars .star[data-value="${prev}"]`)?.click(); }
      });
    });

    // Botões
    document.querySelector('.rating-close')?.addEventListener('click', closeRatingModal);
    document.getElementById('ratingSkip')?.addEventListener('click', closeRatingModal);

    // Submit para API real
    const submitBtn = document.getElementById('ratingSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (ratingState.value === 0 || !ratingState.orderId) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        try {
          const res = await fetch('/api/customer/reviews', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: ratingState.orderId, rating: ratingState.value, comment: (document.getElementById('ratingComment')?.value || '').trim() })
          });
          const data = await res.json().catch(()=>({}));
          if (!res.ok || data.sucesso===false) throw new Error(data.mensagem || 'Falha ao enviar');
          showRatingSuccessAnimation();
          // Atualiza cache local para mostrar estrelas imediatamente
          try { orderRatings.set(ratingState.orderId, ratingState.value); } catch(_) {}
          markReviewed(ratingState.orderId);
          setTimeout(()=>{ closeRatingModal(); }, 1400);
        } catch(err){
          // Feedback mínimo: reabilitar botão
          alert('Erro ao enviar avaliação: ' + err.message);
          submitBtn.disabled = false; submitBtn.textContent = 'Enviar avaliação';
        }
      });
    }

    // Fechar com ESC quando aberto
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const area = document.querySelector('.rating.modalArea');
        if (area && area.style.display === 'flex') closeRatingModal();
      }
    });
  }

  // Polling adaptativo (fallback): pausa quando não há pedidos ativos
  let pollTimer = null;
  let pollingIntervalMs = 30000; // padrão 30s
  function startPolling(){
    if (pollTimer) return;
    pollTimer = setInterval(load, pollingIntervalMs);
  }
  function stopPolling(){ if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function adjustPollingStrategy(orders){
    const hasActive = orders.some(o => ['pendente','preparando','a_caminho'].includes(String(o.status||'').toLowerCase()));
    if (!hasActive) {
      stopPolling();
    } else if (hasActive && !pollTimer) {
      startPolling();
    }
  }

  // ================== Tempo real (WebSocket) ==================
  function initRealtime(){
    if (typeof io !== 'function') return; // cliente socket.io não carregado
    try {
      const socket = io('/cliente', { transports: ['websocket','polling'] });
      socket.on('connect', ()=> {/* console.log('Cliente conectado realtime');*/});
      socket.on('order:updated', (payload)=>{
        if (!payload || !payload.id || !payload.status) return;
        const id = Number(payload.id);
        const st = String(payload.status).toLowerCase();
        if (st === 'entregue') {
          // Atualiza cache e decide se deve abrir modal
          const was = currentOrders.find(o=>o.id===id)?.status;
          if (was && was !== 'entregue' && !reviewedOrders.has(id) && !promptedOrders.has(id)) {
            promptedOrders.add(id); persistPrompted();
            // recarrega lista e abre modal
            load().then(()=> openRatingModal(id));
          } else {
            // se não temos no cache, força recarga para refletir
            if (!was) load();
          }
        } else {
          // outros status: apenas atualizar lista leve a cada alguns segundos (debounce)
          debounceReload();
        }
      });
    } catch(_) { /* silencioso */ }
  }

  const debounceReload = (()=>{ let t; return ()=>{ clearTimeout(t); t=setTimeout(load, 2500); }; })();
  // Export interno (debug opcional)
  window.__PedidosPollingInfo = () => ({ active: !!pollTimer, interval: pollingIntervalMs });
})();
