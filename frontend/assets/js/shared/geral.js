console.log('Geral.js carregado!');

let cart = [];
let modalQt = 1;
let modalKey = 0;
let modalType = 'produto'; // 'produto' ou 'drink'
let produtos;
let drinks;
let categorias = [];
let currentData; // dados atuais sendo exibidos no modal

// GET CART BY SESSION STORAGE
localStorage.getItem("produto_cart")
  ? (cart = JSON.parse(localStorage.getItem("produto_cart")))
  : (cart = []);

// Função para compatibilizar carrinho antigo (qtd -> qt)
cart = cart.map(item => {
  if (item.qtd && !item.qt) {
    item.qt = item.qtd;
    delete item.qtd;
  }
  if (!item.type) {
    item.type = 'produto'; // assume produto para itens antigos
  }
  if (!item.price && item.id) {
    // Recuperar preço se não estiver salvo (será definido após carregar API)
    item.needsPriceUpdate = true;
  }
  return item;
});

// Detecta o caminho correto para assets baseado na localização atual
function getAssetsPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/admin/')) {
        return '../../assets/';
    } else if (currentPath.includes('/customer/')) {
        return '../../assets/';
    } else {
        // Para páginas na raiz de pages/
        return '../assets/';
    }
}

// Aguarda o DOM estar carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, iniciando fetch...');
    
    const assetsPath = getAssetsPath();
    console.log('Assets path:', assetsPath);

  const fetchProducts = fetch(`/api/public/catalog/products`).then(r=>r.json());
  const fetchCategories = fetch(`/api/public/categories`).then(r=>r.json()).catch(()=>({ sucesso:false, data:[] }));
  Promise.all([fetchProducts, fetchCategories])
  .then(([result, catRes]) => {
    if(!result.sucesso){ throw new Error(result.mensagem || 'Falha ao carregar catálogo'); }
    const all = result.data || [];
    // Separar produtos e drinks pelo campo category armazenado
    drinks = all.filter(p => String(p.category).toLowerCase() === 'drink');
    produtos = all.filter(p => String(p.category).toLowerCase() !== 'drink');

    // Normalizar categorias vindas da API pública e garantir canônicas
    const rawCats = Array.isArray(catRes?.data) ? (catRes.data || []) : [];
    const alias = (s)=>{
      const v = String(s||'').toLowerCase();
      if (v === 'bebida' || v === 'bebidas' || v === 'drinks') return 'drink';
      if (v === 'produtos' || v === 'product' || v === 'products') return 'produto';
      return v;
    };
    const titleFor = (slug)=> slug === 'drink' ? 'Bebidas' : (slug === 'produto' ? 'Produtos' : slug);
    const map = new Map();
    rawCats.forEach(c=>{
      const s = alias(c.slug);
      const t = c.title && c.title.trim() ? c.title : titleFor(s);
      if (!map.has(s)) map.set(s, { slug: s, title: t, position: Number(c.position)||0, active: c.active!==0 });
    });
    // Garantir categorias canônicas quando existirem itens correspondentes
    if (drinks.length && !map.has('drink')) map.set('drink', { slug:'drink', title:'Bebidas', position: 999, active: true });
    if (produtos.length && !map.has('produto')) map.set('produto', { slug:'produto', title:'Produtos', position: 1, active: true });
    categorias = Array.from(map.values()).filter(c=>c.active !== false).sort((a,b)=> (a.position||0)-(b.position||0));
    // Fallback final seguro
    if (!categorias.length) categorias = [{ slug:'produto', title:'Produtos' }, { slug:'drink', title:'Bebidas' }];

    // Atualizar preços de itens antigos no carrinho
    cart = cart.map(item => {
      if (item.needsPriceUpdate) {
        let dataArray = item.type === 'produto' ? produtos : drinks;
        let productItem = dataArray.find(product => product.id == item.id);
        if (productItem) {
          item.price = productItem.price[item.size];
        }
        delete item.needsPriceUpdate;
      }
      return item;
    });

    updateCart();

    // Render dinâmico de categorias e itens mantendo estilos
    try {
      const main = document.querySelector('main');
      if (main) {
        // Limpa seções estáticas para evitar duplicação
        main.querySelectorAll('.titulo--h1, .produto-area, .drinks-area').forEach(el => el.remove());
      }
      categorias.forEach(cat => {
        const slug = String(cat.slug||'').toLowerCase();
        const title = cat.title || slug;
        // Heading
        const h1 = document.createElement('h1');
        h1.className = 'titulo--h1';
        h1.id = (slug === 'produto') ? 'produtos' : (slug === 'drink' ? 'bebidas' : slug);
        h1.textContent = title;
        main.appendChild(h1);
        // Grid container
        const area = document.createElement('div');
        area.className = 'produto-area'; // mantém grid e estilos atuais
        area.dataset.slug = slug;
        main.appendChild(area);

        // Selecionar itens da categoria de forma robusta
        let list;
        if (slug === 'drink') {
          list = drinks;
        } else if (slug === 'produto') {
          list = produtos;
        } else {
          list = all.filter(p => String(p.category).toLowerCase() === slug);
        }
        list.forEach(prod => {
          const itemEl = document.querySelector('.models .produto-item').cloneNode(true);
          const isDrink = String(prod.category).toLowerCase() === 'drink';
          const keyIndex = isDrink ? drinks.findIndex(p=>p.id===prod.id) : produtos.findIndex(p=>p.id===prod.id);
          itemEl.setAttribute('data-key', String(keyIndex >= 0 ? keyIndex : 0));
          itemEl.setAttribute('data-type', isDrink ? 'drink' : 'produto');
          itemEl.querySelector('.produto-item--img img').src = prod.img || (assetsPath + 'images/default-images/produto-padrao.png');
          itemEl.querySelector('.produto-item--price').innerHTML = `${(prod.price[2]||0).toLocaleString('pt-br', { style:'currency', currency:'BRL' })}`;
          itemEl.querySelector('.produto-item--name').innerHTML = prod.name;
          itemEl.querySelector('.produto-item--desc').innerHTML = prod.description;
          itemEl.querySelector('a').addEventListener('click', (e)=>{
            e.preventDefault();
            const k = e.currentTarget.closest('.produto-item').getAttribute('data-key');
            const t = e.currentTarget.closest('.produto-item').getAttribute('data-type');
            openModal(k, t);
          });
          area.appendChild(itemEl);
        });
      });
    } catch(err) {
      console.warn('Falha ao renderizar categorias dinâmicas:', err);
    }
  })
  .catch(error => {
    console.error('Erro ao carregar dados:', error);
  });
});

// Função para abrir modal (produtos e drinks)
function openModal(key, type) {
  modalQt = 1;
  modalKey = key;
  modalType = type;
  currentData = type === 'produto' ? produtos : drinks;

  const assetsPath = getAssetsPath();
  document.querySelector(".produtoBig img").src = currentData[key].img || (assetsPath + 'images/default-images/produto-padrao.png');
  document.querySelector(".produtoInfo h1").innerHTML = currentData[key].name;
  document.querySelector(".produtoInfo--desc").innerHTML = currentData[key].description;
  document.querySelector(".produtoInfo--actualPrice").innerHTML = `${currentData[key].price[2].toLocaleString("pt-br", {
    style: "currency",
    currency: "BRL",
  })}`;
  
  // Mostrar/ocultar área de personalização apenas para produtos
  const customizeArea = document.querySelector(".produtoInfo--customizearea");
  const removeIngredientsInput = document.getElementById("removeIngredients");
  
  if (type === 'produto') {
    customizeArea.style.display = 'block';
    removeIngredientsInput.value = '';
  } else {
    customizeArea.style.display = 'none';
  }
  
  // Reset tamanhos
  document.querySelector(".produtoInfo--size.selected")?.classList.remove("selected");
  document.querySelectorAll(".produtoInfo--size").forEach((size, sizeIndex) => {
    if (sizeIndex == 2) {
      size.classList.add("selected");
    }
    size.querySelector("span").innerHTML = currentData[key].sizes[sizeIndex];
  });

  document.querySelector(".produtoInfo--qt").innerHTML = modalQt;
  document.querySelector(".modalArea").style.opacity = 0;
  document.querySelector(".modalArea").style.display = "flex";
  setTimeout(() => {
    document.querySelector(".modalArea").style.opacity = 1;
  }, 200);
}

//##MODAL EVENTS
function closeModal() {
  document.querySelector(".modalArea").style.opacity = 0;
  setTimeout(() => {
    document.querySelector(".modalArea").style.display = "none";
  }, 600);
  window.scrollTo(0, 0);
}

//Fechar modal com Esc
document.addEventListener("keydown", (event) => {
  const isEscKey = event.key === "Escape";
  if (document.querySelector(".modalArea").style.display === "flex" && isEscKey) {
    closeModal();
  }
});

//Fechar modal com click no 'cancelar'
document
  .querySelectorAll(".produtoInfo--cancelButton, .produtoInfo--cancelMobileButton")
  .forEach((item) => {
    item.addEventListener("click", closeModal);
  });

//##CONTROLS
document.querySelector(".produtoInfo--qtmenos").addEventListener("click", () => {
  if (modalQt > 1) {
    let size = parseInt(
      document
        .querySelector(".produtoInfo--size.selected")
        .getAttribute("data-key")
    );
    let preco = currentData[modalKey].price[size];
    modalQt--;
    document.querySelector(".produtoInfo--qt").innerHTML = modalQt;
    let updatePreco = preco * modalQt;
    document.querySelector(
      ".produtoInfo--actualPrice"
    ).innerHTML = `${updatePreco.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
  }
});

document.querySelector(".produtoInfo--qtmais").addEventListener("click", () => {
  let size = parseInt(
    document.querySelector(".produtoInfo--size.selected").getAttribute("data-key")
  );
  let preco = currentData[modalKey].price[size];
  modalQt++;
  document.querySelector(".produtoInfo--qt").innerHTML = modalQt;
  let updatePreco = preco * modalQt;
  document.querySelector(
    ".produtoInfo--actualPrice"
  ).innerHTML = `${updatePreco.toLocaleString("pt-br", {
    style: "currency",
    currency: "BRL",
  })}`;
});

document.querySelectorAll(".produtoInfo--size").forEach((size, sizeIndex) => {
  size.addEventListener("click", (e) => {
    document
      .querySelector(".produtoInfo--size.selected")
      ?.classList.remove("selected");
    size.classList.add("selected");
    
    // Atualizar preço baseado no tamanho selecionado
    modalQt = 1;
    document.querySelector(".produtoInfo--qt").innerHTML = modalQt;
    document.querySelector(
      ".produtoInfo--actualPrice"
    ).innerHTML = `${currentData[modalKey].price[sizeIndex].toLocaleString("pt-br", {
      style: "currency", 
      currency: "BRL"
    })}`;
  });
});

//##ADD CART
document.querySelector(".produtoInfo--addButton").addEventListener("click", () => {
  let size = parseInt(
    document.querySelector(".produtoInfo--size.selected").getAttribute("data-key")
  );

  // Pegar ingredientes removidos (apenas para produtos)
  let removedIngredients = '';
  if (modalType === 'produto') {
    removedIngredients = document.getElementById("removeIngredients").value.trim();
  }

  let identifier = `${currentData[modalKey].id}@${size}@${removedIngredients}`;

  let key = cart.findIndex((item) => item.identifier == identifier);
  if (key > -1) {
    cart[key].qt += modalQt;
  } else {
    cart.push({
      identifier,
      id: currentData[modalKey].id,
      size,
      price: currentData[modalKey].price[size],
      qt: modalQt,
      type: modalType,
      removedIngredients: removedIngredients
    });
  }

  // Adicionar animação ao ícone do carrinho
  document.querySelector(".fa-cart-shopping").classList.add("pulse");

  updateCart();
  closeModal();
  //Salvar no localStorage
  localStorage.setItem("produto_cart", JSON.stringify(cart));
});

// ##CART - Esta função será sobrescrita pelo cart.js
// Removida para evitar conflitos, usando apenas a versão do cart.js

// FINALIZAR PEDIDO: não limpar o carrinho aqui; navegar para checkout
async function __fetchStoreStatus(){
  try {
    const res = await fetch('/api/public/store', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok || !json.sucesso) throw new Error('');
    return json.data || {};
  } catch(_) { return { closedNow: true }; }
}

function __showClosedModal(msg, reopenAt){
  const area = document.getElementById('storeClosedModal');
  if (!area) { alert(msg || 'Estamos fechados no momento.'); return; }
  const p = document.getElementById('storeClosedMsg');
  const parts = [];
  if (msg) parts.push(String(msg));
  if (reopenAt) {
    try { const d = new Date(reopenAt); if (!isNaN(d)) parts.push(`Previsão de reabertura: ${d.toLocaleString('pt-BR')}`); } catch(_) {}
  }
  p.textContent = parts.join(' — ') || 'Volte mais tarde para finalizar seu pedido.';
  area.style.display = 'flex';
  const close = ()=> { area.style.display = 'none'; };
  document.getElementById('storeClosedOk')?.addEventListener('click', close, { once: true });
  area.addEventListener('click', (e)=>{ if (e.target === area) close(); }, { once: true });
}

document.querySelector('.cart--finalizar').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopImmediatePropagation?.();
  const status = await __fetchStoreStatus();
  if (status && status.closedNow === true) {
    __showClosedModal(status.reason, status.reopenAt);
    return false;
  }
  try { document.querySelector('aside')?.classList.remove('show'); } catch(_) {}
  // Auth guard é aplicado globalmente em auth.js/cart.js
  window.location.href = '/checkout';
});

// Se viemos redirecionados por fechamento da loja, abrir modal automaticamente
document.addEventListener('DOMContentLoaded', async ()=>{
  try {
    const url = new URL(window.location.href);
    const flagged = url.searchParams.get('closed') === '1' || localStorage.getItem('pizzaria_trigger_closed_modal') === '1';
    if (!flagged) return;
    // limpar flag para não reabrir em navegações subsequentes
    try { localStorage.removeItem('pizzaria_trigger_closed_modal'); } catch(_) {}
    const status = await __fetchStoreStatus();
    if (status && status.closedNow === true) {
      __showClosedModal(status.reason, status.reopenAt);
    }
  } catch(_) {}
});

//## MOBILE EVENTS
document.querySelector(".menu-openner").addEventListener("click", () => {
  // Em mobile, abrir carrinho; em desktop ele já fica visível
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  if (!isMobile) return;
  const aside = document.querySelector("aside");
  if (aside) {
    aside.classList.add("show");
    aside.style.left = 0;
  }
});
document.querySelector(".menu-closer").addEventListener("click", () => {
  document.querySelector("aside").classList.remove("show");
});

// Aplicar configurações do Instagram salvas no admin
function applyInstagramSettings() {
  try {
    // If layout script already applied Instagram from DB, skip local overrides
    if (window.__layoutControlsInstagram) return;
    const instagramSettings = localStorage.getItem('pizzaria_instagram');
    if (!instagramSettings) return;
    
    const settings = JSON.parse(instagramSettings);
    const instagramSection = document.querySelector('.instagram-section');
    
    if (!instagramSection) return;
    
    // Mostrar/ocultar seção baseado na configuração
    if (!settings.enabled) {
      instagramSection.style.display = 'none';
      return;
    } else {
      instagramSection.style.display = 'block';
    }
    
    // Atualizar textos
    const followText = instagramSection.querySelector('.instagram-follow');
    const handleText = instagramSection.querySelector('.instagram-handle');
    const instagramLink = instagramSection.querySelector('.instagram-link');
    
    if (followText && settings.text) {
      followText.textContent = settings.text;
    }
    
    if (handleText && settings.handle) {
      handleText.textContent = `@${settings.handle}`;
    }
    
    if (instagramLink && settings.handle) {
      const url = `https://www.instagram.com/${settings.handle}/`;
      instagramLink.href = url;
      instagramLink.setAttribute('aria-label', `Instagram ${settings.handle || 'Pizzaria'}`);
    }
    
  } catch (e) {
    console.warn('Erro ao aplicar configurações do Instagram:', e);
  }
}

// Aplicar configurações quando a página carregar
document.addEventListener('DOMContentLoaded', applyInstagramSettings);

// Escutar mudanças no localStorage para atualizar em tempo real
window.addEventListener('storage', (e) => {
  if (e.key === 'pizzaria_instagram') {
    applyInstagramSettings();
  }
});
