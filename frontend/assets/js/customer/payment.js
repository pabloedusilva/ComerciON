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
        return;
      }
    } catch(_) {
      try { localStorage.setItem('pizzaria_trigger_closed_modal', '1'); } catch(_) {}
      window.location.href = '/menu?closed=1';
      return;
    }
  })();
  const Auth = window.AuthSystem;
  // Require auth for payment
  if (!Auth || !Auth.isAuthenticated()) {
    window.location.href = '/login?redirect=' + encodeURIComponent('/payment');
    return;
  }

  // Bloquear acesso à página de pagamento quando loja estiver fechada
  (async ()=>{
    try {
      const res = await fetch('/api/public/store', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.sucesso) throw new Error('');
      if (json.data && json.data.closedNow === true) {
        alert((json.data.reason ? `Estamos fechados: ${json.data.reason}` : 'Estamos fechados no momento.') + '\
\nRetornando ao checkout.');
        window.location.href = '/checkout';
      }
    } catch(_) {
      // Em dúvida, não permitir prosseguir
      alert('Não foi possível verificar o status da loja. Tente novamente mais tarde.');
      window.location.href = '/checkout';
    }
  })();

  const money = (v) => Number(v||0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
  function computeTotal(){
    const cart = JSON.parse(localStorage.getItem('pizza_cart') || '[]');
    let items = 0;
    cart.forEach(i=> items += (i.price||0) * (i.qt||1));
    const entrega = 5;
    const subtotal = items + entrega;
    const desconto = subtotal * 0.1;
    return subtotal - desconto;
  }
  document.getElementById('payTotal').textContent = money(computeTotal());

  function clearCart(){
    localStorage.removeItem('pizza_cart');
    try { localStorage.removeItem('checkout_address'); } catch(_) {}
  }

  const successModal = document.getElementById('successModal');
  const showModal = () => successModal && typeof successModal.showModal === 'function' ? successModal.showModal() : alert('Pedido realizado com sucesso!');

  async function createOrderFromCart(){
    const cart = JSON.parse(localStorage.getItem('pizza_cart') || '[]');
    if (!Array.isArray(cart) || cart.length === 0) throw new Error('Carrinho vazio');
    // Tentar recuperar endereço do checkout armazenado temporariamente
    let address = null;
    try {
      const raw = localStorage.getItem('checkout_address');
      if (raw) address = JSON.parse(raw);
    } catch (_) { address = null; }
    const token = Auth.token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const body = { items: cart };
    if (address && typeof address === 'object') body.address = address;
    const res = await fetch('/api/customer/orders', { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await res.json().catch(()=>({}));
    if (!res.ok || !json.sucesso) {
      if (json && json.codigo === 'STORE_CLOSED') {
        throw new Error(json.mensagem || 'Estamos fechados no momento.');
      }
      throw new Error(json.mensagem || 'Falha ao criar pedido');
    }
    return json.data;
  }

  document.getElementById('simulatePay').addEventListener('click', async ()=>{
    const btn = document.getElementById('simulatePay');
    btn.disabled = true; btn.textContent = 'Processando...';
    try {
      // Primeiro cria o pedido no backend
      await createOrderFromCart();
      // Limpa o carrinho só após persistir
      clearCart();
      try { localStorage.setItem('pizzaria_show_post_payment_success', '1'); } catch(_) {}
      window.location.href = '/menu';
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Pagar';
      alert(e.message || 'Não foi possível concluir o pagamento.');
    }
  });

  document.getElementById('backToCheckout').addEventListener('click', ()=>{
    window.location.href = '/checkout';
  });

  document.getElementById('goToHome').addEventListener('click', ()=>{
    window.location.href = '/';
  });
  document.getElementById('closeSuccess').addEventListener('click', ()=>{
    if (successModal && typeof successModal.close === 'function') successModal.close();
  });
})();
