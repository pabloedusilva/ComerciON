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
      return `
        <div class="order-card">
          <div class="order-header">
            <span class="order-id">#${o.id}</span>
            <span class="order-status ${st}">${statusText[st] || '—'}</span>
          </div>
          <div class="order-body">
            <div class="order-items">${resumo || 'Itens indisponíveis'}</div>
            <div class="order-total">Total: <strong>${money(o.total)}</strong></div>
            <div class="order-date">${fmtDate(o.created_at)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function load(){
    try {
      const res = await fetch('/api/customer/orders', { headers });
      const json = await res.json();
      if (!res.ok || !json.sucesso) throw new Error(json.mensagem || 'Erro');
      render(json.data || []);
      document.body.classList.add('data-ready');
    } catch(e){
      console.warn('Falha ao carregar pedidos:', e.message);
      listEl.innerHTML = '<div class="order-card"><div class="order-body">Erro ao carregar seus pedidos.</div></div>';
    }
  }

  load();
})();
