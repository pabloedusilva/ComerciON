// Event listener removido para evitar duplicação
// A funcionalidade de adicionar ao carrinho está no geral.js
//Salvar itens do carrinho no localStorage
const saveCart = () => {
  localStorage.setItem("pizza_cart", JSON.stringify(cart));
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

    let pizzasValor = 0;
    let subtotal = 0;
    let entrega = 5;
    let desconto = 0;
    let total = 0;

    for (let i in cart) {
      // Determinar se é pizza ou drink e buscar no array correto
      let dataArray = cart[i].type === 'pizza' ? pizzas : drinks;
      let pizzaItem = dataArray.find((item) => item.id == cart[i].id);
      
      // Se não encontrou o item, pular para o próximo
      if (!pizzaItem) {
        continue;
      }
      
      pizzasValor += cart[i].price * cart[i].qt;

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
            const curr = localStorage.getItem('pizza_cart');
            if (curr) localStorage.setItem('pizza_cart_backup', curr);
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
      let pizzaSizeName = pizzaItem.sizes[cart[i].size];
      let pizzaName = `${pizzaItem.name} (${pizzaSizeName})`;
      
      // Adicionar ingredientes removidos se houver
      if (cart[i].removedIngredients && cart[i].removedIngredients.length > 0) {
        pizzaName += `<br><small style="color: #999; font-size: 11px;">Sem: ${cart[i].removedIngredients}</small>`;
      }
      
      let cartItem = document
        .querySelector(".models .cart--item")
        .cloneNode(true);

      cartItem.querySelector("img").src = pizzaItem.img;
      cartItem.querySelector(".cart--item-nome").innerHTML = pizzaName;
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

    subtotal = pizzasValor + entrega;
    desconto = subtotal * 0.1;
    total = subtotal - desconto;

    document.querySelector(
      ".pizzasValor span:last-child"
    ).innerHTML = `${pizzasValor.toLocaleString("pt-br", {
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
          <p class="cart-empty-sub">Adicione pizzas ou bebidas para começar</p>
          <a href="/menu#pizzas" class="cart-empty-cta">Ver Cardápio</a>
        </div>
      `);
      // Tornar o CTA mais inteligente: se já estamos no menu, apenas fechar o carrinho e focar no cardápio
      const cta = cartEl.querySelector('.cart-empty-cta');
      if (cta) {
        cta.addEventListener('click', (ev) => {
          if (window.location.pathname === '/menu') {
            ev.preventDefault();
            const aside = document.querySelector('aside');
            if (aside) {
              aside.classList.remove('show');
              aside.style.left = '100vw';
            }
            const anchor = document.getElementById('pizzas');
            if (anchor && typeof anchor.scrollIntoView === 'function') {
              anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              window.location.hash = '#pizzas';
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
    document.querySelector(".pizzasValor span:last-child").textContent = zero;
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

// Controla a sequência de modais: sucesso -> avaliação
let ratingState = {
  value: 0,
  openedAfterSuccess: false,
  inited: false
};

function openRatingModal() {
  const ratingArea = document.querySelector('.rating.pizzaWindowArea');
  if (!ratingArea) return;
  // Reset estado visual
  ratingState.value = 0;
  document.querySelectorAll('.rating-stars .star').forEach(s => {
    s.classList.remove('active');
    s.classList.remove('fa-solid');
    s.classList.add('fa-regular');
  });
  const ta = document.getElementById('ratingComment');
  if (ta) ta.value = '';
  const submitBtn = document.getElementById('ratingSubmit');
  if (submitBtn) submitBtn.disabled = true;

  // Abrir modal com mesma transição
  ratingArea.style.opacity = 0;
  ratingArea.style.display = 'flex';
  setTimeout(() => { ratingArea.style.opacity = 1; }, 200);
}

function closeRatingModal() {
  const ratingArea = document.querySelector('.rating.pizzaWindowArea');
  const successAnimation = document.getElementById('ratingSuccessAnimation');
  if (!ratingArea) return;
  
  // Remover animação de sucesso se estiver visível
  if (successAnimation) {
    successAnimation.classList.remove('show');
  }
  
  // Fechar modal com transição
  ratingArea.style.opacity = 0;
  setTimeout(() => { 
    ratingArea.style.display = 'none'; 
    ratingState.openedAfterSuccess = false;
  }, 200);
}

function showRatingSuccessAnimation() {
  const successAnimation = document.getElementById('ratingSuccessAnimation');
  if (successAnimation) {
    successAnimation.classList.add('show');
  }
}

function initRatingInteractionsOnce() {
  if (ratingState.inited) return;
  ratingState.inited = true;

  // Clique nas estrelas
  document.querySelectorAll('.rating-stars .star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.getAttribute('data-value')) || 0;
      ratingState.value = val;
      // marca todas até o valor como ativas
      document.querySelectorAll('.rating-stars .star').forEach(s => {
        const sVal = parseInt(s.getAttribute('data-value')) || 0;
        s.classList.toggle('active', sVal <= val);
        // troca para sólido quando ativo
        if (s.classList.contains('active')) {
          s.classList.remove('fa-regular');
          s.classList.add('fa-solid');
        } else {
          s.classList.add('fa-regular');
          s.classList.remove('fa-solid');
        }
      });
      const submitBtn = document.getElementById('ratingSubmit');
      if (submitBtn) submitBtn.disabled = ratingState.value === 0;
    });
  });

  // Acessibilidade: Enter/Space seleciona estrela focada
  document.querySelectorAll('.rating-stars .star').forEach(star => {
    star.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        star.click();
      }
    });
  });

  // Submit
  const submitBtn = document.getElementById('ratingSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      if (ratingState.value === 0) return;
      
      // Mostrar animação de sucesso
      showRatingSuccessAnimation();
      
      // Salvar dados da avaliação
      const comment = (document.getElementById('ratingComment')?.value || '').trim();
      try {
        const payload = { stars: ratingState.value, comment, ts: Date.now() };
        // Poderíamos enviar para backend aqui; por enquanto, salva local
        const prev = JSON.parse(localStorage.getItem('last_rating') || 'null');
        localStorage.setItem('last_rating', JSON.stringify(payload));
        if (window && window.console) console.log('Avaliação registrada:', payload, 'Anterior:', prev);
      } catch (_) {}
      
      // Fechar modal após a animação
      setTimeout(() => {
        closeRatingModal();
      }, 2000);
    });
  }

  // Fechar mobile/back
  document.querySelector('.rating-close')?.addEventListener('click', closeRatingModal);
  // Pular avaliação
  document.getElementById('ratingSkip')?.addEventListener('click', closeRatingModal);
  // Fechar com ESC quando aberto
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const ratingArea = document.querySelector('.rating.pizzaWindowArea');
      if (ratingArea && ratingArea.style.display === 'flex') closeRatingModal();
    }
  });
}

document.querySelector(".cart--finalizar").addEventListener("click", (e) => {
  e.preventDefault();
  const auth = window.AuthSystem;
  const isAuth = !!(auth && typeof auth.isAuthenticated === 'function' && auth.isAuthenticated());
  if (!isAuth) {
    try {
      const curr = localStorage.getItem('pizza_cart');
      if (curr) localStorage.setItem('pizza_cart_backup', curr);
      localStorage.setItem('pizzaria_open_cart_on_load', '1');
    } catch(_) {}
    window.location.href = '/login?redirect=' + encodeURIComponent('/menu#checkout');
    return;
  }
  // Rota segura do checkout
  window.location.href = '/checkout';
});

// Pós-pagamento: abrir modal de "pedido sendo preparado" e depois avaliação
document.addEventListener('DOMContentLoaded', () => {
  try {
    const shouldShow = localStorage.getItem('pizzaria_show_post_payment_success') === '1';
    if (!shouldShow) return;
    // Limpar flag para não repetir
    localStorage.removeItem('pizzaria_show_post_payment_success');

    const loader = document.querySelector('.loader-content');
    const successArea = document.querySelector('.success.pizzaWindowArea');
    if (loader) loader.classList.add('display');

    // Pequena simulação de carregamento antes de mostrar o sucesso
    setTimeout(() => {
      if (loader) loader.classList.remove('display');
      if (successArea) {
        successArea.style.opacity = 0;
        successArea.style.display = 'flex';
        setTimeout(() => { successArea.style.opacity = 1; }, 200);
        // Manter visível por 4s como antes
        setTimeout(() => {
          successArea.style.opacity = 0;
          setTimeout(() => {
            successArea.style.display = 'none';
            // Após fechar sucesso, exibir avaliação
            ratingState.openedAfterSuccess = true;
            initRatingInteractionsOnce();
            openRatingModal();
          }, 200);
        }, 4000);
      }
    }, 900);
  } catch(_) {}
});
