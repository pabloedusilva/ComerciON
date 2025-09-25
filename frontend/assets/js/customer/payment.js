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

  document.getElementById('simulatePay').addEventListener('click', ()=>{
    // Simular processamento (sem validação de cartão)
    const btn = document.getElementById('simulatePay');
    btn.disabled = true; btn.textContent = 'Processando...';
    setTimeout(()=>{
      clearCart();
      btn.disabled = false; btn.textContent = 'Pagar';
      try {
        // Sinalizar para a página de menu abrir o fluxo de sucesso e avaliação
        localStorage.setItem('pizzaria_show_post_payment_success', '1');
      } catch(_) {}
      // Redirecionar para o menu para mostrar o modal "sendo preparado" e, em seguida, avaliação
      window.location.href = '/menu';
    }, 1200);
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
