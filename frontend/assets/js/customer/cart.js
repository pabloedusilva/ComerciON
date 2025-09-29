// Event listener removido para evitar duplicação
// A funcionalidade de adicionar ao carrinho está no geral.js
//Salvar itens do carrinho no localStorage
const saveCart = () => {
  localStorage.setItem("produto_cart", JSON.stringify(cart));
};

// Mobile: abrir carrinho ao clicar no ícone (no menu.html isso abre imediatamente)
document.querySelector(".menu-openner").addEventListener("click", () => {
  // Abrir carrinho mesmo sem itens; o estado vazio é tratado na UI
  const aside = document.querySelector("aside");
  if (aside) {
    aside.style.left = 0;
    aside.classList.add("show");
  }
});

document.querySelector(".menu-closer").addEventListener("click", () => {
  const aside = document.querySelector("aside");
  if (!aside) return;
  aside.classList.remove('show');
  aside.style.left = "100vw";
});

function updateCart() {
  document.querySelector(".menu-openner span").innerHTML = cart.length;

  if (cart.length > 0) {
    // Mostrar totais quando houver itens
    const details = document.querySelector('.cart--details');
    if (details) details.style.display = '';
    document.querySelector(".cart").innerHTML = ""; //Limpar carrinho

    let produtosValor = 0;
    let subtotal = 0;
    let entrega = 5;
    let desconto = 0;
    let total = 0;

    for (let i in cart) {
      // Determinar se é pizza ou drink e buscar no array correto
      let dataArray = cart[i].type === 'produto' ? produtos : drinks;
      let produtoItem = dataArray.find((item) => item.id == cart[i].id);
      
      // Se não encontrou o item, pular para o próximo
      if (!produtoItem) {
        continue;
      }
      
      produtosValor += cart[i].price * cart[i].qt;

  // Proteção de checkout extremamente rígida
  const enforceCheckoutAuth = () => {
    const auth = window.AuthSystem;
    const candidates = document.querySelectorAll('.cart--finalizar, .checkout-btn, [data-checkout]');
    if (!candidates || candidates.length === 0) return;
    candidates.forEach((btn) => {
      // Evitar múltiplos binds quando updateCart() é chamado várias vezes
      if (btn.getAttribute('data-auth-guarded') === '1') return;
      btn.setAttribute('data-auth-guarded', '1');
      btn.addEventListener('click', (ev) => {
        const isAuth = !!(auth && typeof auth.isAuthenticated === 'function' && auth.isAuthenticated());
        if (!isAuth) {
          ev.preventDefault();
          // Impede outros listeners, inclusive em fase de captura
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          try {
            const curr = localStorage.getItem('produto_cart');
            if (curr) localStorage.setItem('produto_cart_backup', curr);
            // Garante abertura do carrinho ao voltar do login
            localStorage.setItem('pizzaria_open_cart_on_load', '1');
          } catch(_) {}
          window.location.href = '/login?redirect=/menu%23checkout';
        }
      }, { capture: true });
    });
  };
  // Defer para garantir DOM pronto e elementos presentes
  setTimeout(enforceCheckoutAuth, 0);
      // Nome do tamanho dinâmico
      let produtoSizeName = '';
      if (Array.isArray(produtoItem.price)) {
        const count = produtoItem.price.map(n=>Number(n)||0).filter(v=>v>0).length;
        if (count === 1) produtoSizeName = 'Único';
        else produtoSizeName = ['Pequeno','Médio','Grande'][cart[i].size] || '';
      }
      let produtoName = produtoSizeName ? `${produtoItem.name} (${produtoSizeName})` : `${produtoItem.name}`;
      
      // Adicionar ingredientes removidos se houver
      if (cart[i].removedIngredients && cart[i].removedIngredients.length > 0) {
        produtoName += `<br><small style="color: #999; font-size: 11px;">Sem: ${cart[i].removedIngredients}</small>`;
      }
      
      let cartItem = document
        .querySelector(".models .cart--item")
        .cloneNode(true);

      cartItem.querySelector("img").src = produtoItem.img;
      cartItem.querySelector(".cart--item-nome").innerHTML = produtoName;
      cartItem.querySelector(".cart--item--qt").innerHTML = cart[i].qt;
      cartItem
        .querySelector(".cart--item-qtmenos")
        .addEventListener("click", () => {
          if (cart[i].qt > 1) {
            cart[i].qt--;
          } else {
            cart.splice(i, 1);
          }
          updateCart();
          saveCart();
        });
      cartItem
        .querySelector(".cart--item-qtmais")
        .addEventListener("click", () => {
          cart[i].qt++;
          updateCart();
          saveCart();
        });

      document.querySelector(".cart").append(cartItem);
    }

    subtotal = produtosValor + entrega;
    desconto = subtotal * 0.1;
    total = subtotal - desconto;

    document.querySelector(
      ".produtosValor span:last-child"
    ).innerHTML = `${produtosValor.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".entrega span:last-child"
    ).innerHTML = `${entrega.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".subtotal span:last-child"
    ).innerHTML = `${subtotal.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".desconto span:last-child"
    ).innerHTML = `${desconto.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".total span:last-child"
    ).innerHTML = `${total.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
  } else {
    // Em vez de fechar o carrinho, renderizamos um estado vazio minimalista
    const cartEl = document.querySelector('.cart');
    if (cartEl) {
      cartEl.innerHTML = '';
      cartEl.insertAdjacentHTML('beforeend', `
        <div class="cart-empty">
          <div class="cart-empty-icon"><i class="fa-regular fa-face-frown"></i></div>
          <h2 class="cart-empty-title">Seu carrinho está vazio</h2>
          <p class="cart-empty-sub">Adicione produtos ou bebidas para começar</p>
          <a href="/menu#produtos" class="cart-empty-cta">Ver Cardápio</a>
        </div>
      `);
      // Tornar o CTA mais inteligente: se já estamos no menu, apenas fechar o carrinho e focar no cardápio
      const cta = cartEl.querySelector('.cart-empty-cta');
      if (cta) {
        cta.addEventListener('click', (ev) => {
          if (window.location.pathname === '/menu') {
            ev.preventDefault();
            // Em desktop, manter carrinho fixo; em mobile, fechar ao navegar para a âncora
            const isMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
            const aside = document.querySelector('aside');
            if (isMobile && aside) {
              aside.classList.remove('show');
              aside.style.left = '100vw';
            }
            const anchor = document.getElementById('produtos');
            if (anchor && typeof anchor.scrollIntoView === 'function') {
              anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              window.location.hash = '#produtos';
            }
          }
        });
      }
    }
    // Ocultar totais e botão finalizar no estado vazio
    const details = document.querySelector('.cart--details');
    if (details) details.style.display = 'none';
    // Zera os totais exibidos
    const zero = (0).toLocaleString("pt-br", { style: "currency", currency: "BRL" });
    document.querySelector(".produtosValor span:last-child").textContent = zero;
    document.querySelector(".entrega span:last-child").textContent = zero;
    document.querySelector(".subtotal span:last-child").textContent = zero;
    document.querySelector(".desconto span:last-child").textContent = zero;
    document.querySelector(".total span:last-child").textContent = zero;
    // Não abrir automaticamente o carrinho no estado vazio; respeitar estado atual
  }

  // Em telas grandes (desktop), manter o carrinho visível como antes
  try {
    const isDesktop = window.matchMedia && window.matchMedia('(min-width: 821px)').matches;
    if (isDesktop) {
      const aside = document.querySelector('aside');
      if (aside) {
        aside.classList.add('show');
        aside.style.left = 0;
      }
    }
  } catch(_) {}
}

// Auto-abertura do carrinho quando viemos de outra página mobile
document.addEventListener('DOMContentLoaded', function(){
  try {
    const shouldOpen = localStorage.getItem('pizzaria_open_cart_on_load') === '1';
    if (shouldOpen) {
      const aside = document.querySelector('aside');
      if (aside) {
        aside.style.left = 0;
        aside.classList.add('show');
      }
      // Renderizar estado atual (vazio ou com itens) imediatamente
      try { updateCart(); } catch(_) {}
    }
  } finally {
    // limpar a flag independente do resultado
    try { localStorage.removeItem('pizzaria_open_cart_on_load'); } catch(_) {}
  }
});


// Handler de finalizar movido para shared/geral.js para unificar spinner/fechamento

// Pós-pagamento: abrir modal de "pedido sendo preparado" e depois avaliação
// Removido: fluxo de modal de avaliação e pós-pagamento
