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
        ? `<div class="order-address" style="margin-top:2px; color:#6b7280; font-size:.9rem;">
             <i class="fas fa-info-circle" aria-hidden="true" style="color:#9ca3af"></i>
             <span>${addrObj.numero ? 'Número: ' + addrObj.numero : ''}${addrObj.numero && addrObj.bairro ? ' • ' : ''}${addrObj.bairro ? 'Bairro: ' + addrObj.bairro : ''}</span>
           </div>`
        : '';
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
          ${fmtAddr ? `<div class="order-address"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> <span>${fmtAddr}</span></div>` : ''}
          ${numeroBairro}
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
