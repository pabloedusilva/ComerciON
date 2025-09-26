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
        json.data.forEach(r => { reviewedOrders.add(r.order_id); orderRatings.set(r.order_id, Number(r.rating)||0); });
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
      const resumo = items.map(it=> `${it.quantity}x ${it.category==='pizza'?'Pizza':'Bebida'} ${['320g','530g','860g'][it.size]||''}`).join(', ');
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
          openReviewModal(ord.id);
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
      btn.addEventListener('click', ()=> openReviewModal(parseInt(btn.dataset.orderId,10)));
    });
  }

  function markReviewed(orderId){
    reviewedOrders.add(orderId);
    // re-render para remover botão
    try { load(); } catch(_) {}
  }

  function openReviewModal(orderId){
    let modal = document.getElementById('reviewModal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'reviewModal';
    modal.className = 'rv-overlay';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Avaliar pedido');
    modal.innerHTML = `
      <div class="rv-modal" tabindex="-1">
        <button id="rvClose" aria-label="Fechar" class="rv-close">&times;</button>
        <h3 id="rvTitle" class="rv-title">Avaliar Pedido #${orderId}</h3>
        <p class="rv-sub">Sua opinião ajuda a manter a qualidade. Classifique de 1 a 5 estrelas.</p>
        <div id="rvStars" aria-labelledby="rvTitle" role="radiogroup" class="rv-stars">
          ${[1,2,3,4,5].map(i=>`<button type="button" class="rv-star-btn" data-val="${i}" role="radio" aria-checked="false" aria-label="${i} estrela${i>1?'s':''}"><i data-val="${i}" class="fas fa-star rv-star"></i></button>`).join('')}
        </div>
        <label for="rvComment" class="rv-label">Comentário (opcional)</label>
        <textarea id="rvComment" rows="4" maxlength="4000" class="rv-textarea" placeholder="Conte como foi sua experiência (opcional)"></textarea>
        <div class="rv-actions">
          <button id="rvSkip" class="rv-btn rv-btn-gray">Agora não</button>
          <div class="rv-actions-right">
            <button id="rvCancel" class="rv-btn rv-btn-secondary">Cancelar</button>
            <button id="rvSubmit" disabled class="rv-btn rv-btn-primary is-disabled">Enviar</button>
          </div>
        </div>
        <div id="rvMsg" class="rv-msg"></div>
      </div>`;
    document.body.appendChild(modal);
    const close = ()=> modal && modal.remove();
    modal.addEventListener('click', e=>{ if(e.target===modal) close(); });
    modal.querySelector('#rvClose').addEventListener('click', close);
    modal.querySelector('#rvCancel').addEventListener('click', close);

    let currentRating = 0;
    const starBtns = modal.querySelectorAll('.rv-star-btn');
    function paint(){
      starBtns.forEach(btn=>{
        const v = Number(btn.dataset.val);
        if (v <= currentRating) btn.classList.add('active'); else btn.classList.remove('active');
        btn.setAttribute('aria-checked', v === currentRating ? 'true' : 'false');
      });
    }
    starBtns.forEach(btn=>{
      btn.addEventListener('click', ()=>{ currentRating = Number(btn.dataset.val); paint(); updateSubmitState(); });
      btn.addEventListener('keydown', (e)=>{
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); currentRating = Math.min(5, currentRating+1 || 1); paint(); updateSubmitState(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); currentRating = Math.max(1, currentRating-1 || 1); paint(); updateSubmitState(); }
      });
    });
    paint();

    const submitBtn = modal.querySelector('#rvSubmit');
    function updateSubmitState(){
      const disabled = currentRating < 1;
      submitBtn.disabled = disabled;
      submitBtn.classList.toggle('is-disabled', disabled);
    }
    updateSubmitState();

  const skipBtn = modal.querySelector('#rvSkip');
  skipBtn.addEventListener('click', ()=> close());
  submitBtn.addEventListener('click', async ()=>{
      if (currentRating < 1) return; // guard
      submitBtn.disabled = true; submitBtn.textContent = 'Enviando...';
      const msgEl = modal.querySelector('#rvMsg'); msgEl.textContent='';
      try {
        const res = await fetch('/api/customer/reviews', { method:'POST', headers: { ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ order_id: orderId, rating: currentRating, comment: modal.querySelector('#rvComment').value }) });
        const data = await res.json().catch(()=>({}));
        if(!res.ok || data.sucesso===false) throw new Error(data.mensagem || 'Falha ao enviar');
  msgEl.className = 'rv-msg success';
  msgEl.textContent = '✅ Avaliação registrada! Obrigado.';
        markReviewed(orderId);
        setTimeout(()=> close(), 1200);
      } catch(err){
  msgEl.className = 'rv-msg error';
  msgEl.textContent = 'Erro: ' + err.message;
        submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; updateSubmitState();
      }
    });

    // Focus & ESC / trap básico
    const focusables = Array.from(modal.querySelectorAll('button, textarea')); 
    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length -1];
    if (firstEl) firstEl.focus();
    modal.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
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
            load().then(()=> openReviewModal(id));
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
