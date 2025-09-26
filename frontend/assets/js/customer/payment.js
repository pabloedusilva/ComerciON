(function(){
  const Auth = window.AuthSystem;
  // Require auth for payment
  if (!Auth || !Auth.isAuthenticated()) {
    window.location.href = '/login?redirect=' + encodeURIComponent('/payment');
    return;
  }

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
  }

  const successModal = document.getElementById('successModal');
  const showModal = () => successModal && typeof successModal.showModal === 'function' ? successModal.showModal() : alert('Pedido realizado com sucesso!');

  async function createOrderFromCart(){
    const cart = JSON.parse(localStorage.getItem('pizza_cart') || '[]');
    if (!Array.isArray(cart) || cart.length === 0) throw new Error('Carrinho vazio');
    const token = Auth.token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/customer/orders', { method: 'POST', headers, body: JSON.stringify({ items: cart }) });
    const json = await res.json().catch(()=>({}));
    if (!res.ok || !json.sucesso) throw new Error(json.mensagem || 'Falha ao criar pedido');
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
