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
    // Usar somente o que vier do banco (public/categories) respeitando active=1
    categorias = Array.from(map.values())
      .filter(c=>c.active !== false)
      .sort((a,b)=> (a.position||0)-(b.position||0));

    // (NOVO) Adicionar categorias efêmeras para quaisquer slugs de produtos que não vieram do banco
    try {
      const productSlugs = new Set();
      all.forEach(p => {
        const s = alias(p.category || p.slug || '');
        if (s) productSlugs.add(s);
      });
      const existingSlugs = new Set(categorias.map(c=>c.slug));
      const ephemeral = [];
      productSlugs.forEach(s => {
        if (!existingSlugs.has(s)) {
          // Criar categoria efêmera apenas para organizar visualmente
          ephemeral.push({ slug: s, title: titleFor(s), position: 9999, active: true, _ephemeral: true });
        }
      });
      if (ephemeral.length) {
        categorias = [...categorias, ...ephemeral].sort((a,b)=> (a.position||0)-(b.position||0));
      }
    } catch(e) {
      console.warn('Falha ao gerar categorias efêmeras', e);
    }

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

        // Selecionar itens APENAS da própria categoria (sem agrupar tudo em 'produto')
        // Mantém apenas tratamento especial para drinks (já separado em array próprio)
        let list;
        if (slug === 'drink') {
          list = drinks;
        } else {
          // Usar mesma normalização (alias) para casar slugs equivalentes (ex: 'produtos' -> 'produto')
          list = all.filter(p => alias(p.category) === slug);
        }
        list.forEach(prod => {
          const itemEl = document.querySelector('.models .produto-item').cloneNode(true);
          const isDrink = String(prod.category).toLowerCase() === 'drink';
          const keyIndex = isDrink ? drinks.findIndex(p=>p.id===prod.id) : produtos.findIndex(p=>p.id===prod.id);
          itemEl.setAttribute('data-key', String(keyIndex >= 0 ? keyIndex : 0));
          itemEl.setAttribute('data-type', isDrink ? 'drink' : 'produto');
          const imgEl = itemEl.querySelector('.produto-item--img img');
          imgEl.src = prod.img || '';
          imgEl.setAttribute('data-fallback','');
          // Mostrar o maior preço disponível (não-zero) na listagem
          try {
            const pArr = Array.isArray(prod.price) ? prod.price.map(n=>Number(n)||0) : [0,0,0];
            const maxPrice = Math.max(...pArr.filter(v=>v>0), 0);
            itemEl.querySelector('.produto-item--price').innerHTML = `${maxPrice.toLocaleString('pt-br', { style:'currency', currency:'BRL' })}`;
          } catch(_) {
            itemEl.querySelector('.produto-item--price').innerHTML = `${(prod.price?.[2]||0).toLocaleString('pt-br', { style:'currency', currency:'BRL' })}`;
          }
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
  const bigImg = document.querySelector(".produtoBig img");
  if(bigImg){ bigImg.src = currentData[key].img || ''; bigImg.setAttribute('data-fallback',''); }
  document.querySelector(".produtoInfo h1").innerHTML = currentData[key].name;
  document.querySelector(".produtoInfo--desc").innerHTML = currentData[key].description;
  // Preparar tamanhos dinâmicos com base nos preços disponíveis (>0)
  const prices = Array.isArray(currentData[key].price) ? currentData[key].price.map(n=>Number(n)||0) : [0,0,0];
  const available = prices
    .map((v, idx) => ({ idx, v }))
    .filter(({ v }) => v > 0);
  const sizeEls = Array.from(document.querySelectorAll('.produtoInfo--size'));
  const sizeArea = document.querySelector('.produtoInfo--sizearea');
  const sizeList = document.querySelector('.produtoInfo--sizes');
  // Label dinâmico sem gramas
  const sizeLabels = ['Pequeno', 'Médio', 'Grande'];
  const hasSingle = available.length === 1;
  const setChip = (el, label, dataKey, selected) => {
    if (!el) return;
    el.style.display = 'inline-flex';
    el.setAttribute('data-key', String(dataKey));
    // Exibir apenas o nome do tamanho, sem spans auxiliares
    el.textContent = label;
    if (selected) el.classList.add('selected'); else el.classList.remove('selected');
  };
  // Exibir/ocultar itens conforme disponibilidade
  sizeEls.forEach((el) => el.style.display = 'none');
  if (available.length === 0) {
    // fallback: esconder área de tamanho e usar preço 0
    if (sizeArea) sizeArea.style.display = 'none';
    document.querySelector('.produtoInfo--actualPrice').innerHTML = (0).toLocaleString('pt-br',{style:'currency',currency:'BRL'});
  } else if (hasSingle) {
    if (sizeArea) sizeArea.style.display = 'block';
    const only = available[0];
    const el = sizeEls[0];
    const label = (only.idx === 0) ? 'Único' : (sizeLabels[only.idx] || `Tamanho ${only.idx+1}`);
    setChip(el, label, only.idx, true);
    // esconder os demais
    sizeEls.slice(1).forEach(e=>{ e.style.display='none'; e.classList.remove('selected'); });
    document.querySelector('.produtoInfo--actualPrice').innerHTML = prices[only.idx].toLocaleString('pt-br',{style:'currency',currency:'BRL'});
  } else {
    if (sizeArea) sizeArea.style.display = 'block';
    let firstShown = false;
    available.forEach(({ idx }, order) => {
      const el = sizeEls[order];
      if (!el) return;
      const label = sizeLabels[idx] || `Tamanho ${idx+1}`;
      setChip(el, label, idx, !firstShown);
      if (!firstShown) firstShown = true;
    });
    // esconder qualquer extra
    sizeEls.slice(available.length).forEach(e=>{ e.style.display='none'; e.classList.remove('selected'); });
    const selectedIdx = parseInt(document.querySelector('.produtoInfo--size.selected')?.getAttribute('data-key')) || available[0].idx;
    document.querySelector('.produtoInfo--actualPrice').innerHTML = prices[selectedIdx].toLocaleString('pt-br',{style:'currency',currency:'BRL'});
  }
  
  // Mostrar/ocultar área de personalização apenas para produtos
  const customizeArea = document.querySelector(".produtoInfo--customizearea");
  const removeIngredientsInput = document.getElementById("removeIngredients");
  
  if (type === 'produto') {
    customizeArea.style.display = 'block';
    removeIngredientsInput.value = '';
  } else {
    customizeArea.style.display = 'none';
  }
  
  // Eventos de tamanho: atualização de preço com base no 'data-key' da opção ativa

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
    const sizeEl = document.querySelector('.produtoInfo--size.selected');
    const size = sizeEl ? parseInt(sizeEl.getAttribute('data-key')) : 0;
    const preco = (currentData[modalKey].price || [0,0,0])[size] || 0;
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
  const selectedEl = document.querySelector('.produtoInfo--size.selected');
  const size = selectedEl ? parseInt(selectedEl.getAttribute('data-key')) : (Array.isArray(currentData[modalKey].price)? currentData[modalKey].price.findIndex(v=>Number(v)>0) : 0);
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

document.querySelectorAll(".produtoInfo--size").forEach((sizeEl) => {
  sizeEl.addEventListener("click", (e) => {
    document.querySelector(".produtoInfo--size.selected")?.classList.remove("selected");
    const el = e.currentTarget;
    el.classList.add("selected");
    const idx = parseInt(el.getAttribute('data-key')) || 0;
    // Atualizar preço baseado no tamanho selecionado
    modalQt = 1;
    document.querySelector(".produtoInfo--qt").innerHTML = modalQt;
    const priceArr = (currentData[modalKey].price || [0,0,0]);
    const current = Number(priceArr[idx]) || 0;
    document.querySelector(".produtoInfo--actualPrice").innerHTML = current.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
  });
});

//##ADD CART
document.querySelector(".produtoInfo--addButton").addEventListener("click", () => {
  const addSelectedEl = document.querySelector('.produtoInfo--size.selected');
  const addSize = addSelectedEl ? parseInt(addSelectedEl.getAttribute('data-key')) : (Array.isArray(currentData[modalKey].price)? currentData[modalKey].price.findIndex(v=>Number(v)>0) : 0);

  // Pegar ingredientes removidos (apenas para produtos)
  let removedIngredients = '';
  if (modalType === 'produto') {
    removedIngredients = document.getElementById("removeIngredients").value.trim();
  }

  let identifier = `${currentData[modalKey].id}@${addSize}@${removedIngredients}`;

  let key = cart.findIndex((item) => item.identifier == identifier);
  if (key > -1) {
    cart[key].qt += modalQt;
  } else {
    cart.push({
      identifier,
      id: currentData[modalKey].id,
      size: addSize,
      price: (currentData[modalKey].price || [0,0,0])[addSize] || 0,
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
  } catch(_) { return { effectiveClosed: true, closedNow: true }; }
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

// Finalizar compra: spinner só se for seguir para checkout (loja aberta)
(() => {
  const btn = document.querySelector('.cart--finalizar');
  if (!btn) return;
  if (btn.getAttribute('data-finalize-bound') === '1') return; // evitar binds duplicados
  btn.setAttribute('data-finalize-bound', '1');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    // Se não autenticado, deixar o auth.js cuidar do redirecionamento
    try {
      const isAuth = !!(window.AuthSystem && typeof window.AuthSystem.isAuthenticated === 'function' && window.AuthSystem.isAuthenticated());
      if (!isAuth) return false;
    } catch(_) {}

    // Verificar status da loja; se fechada, abrir modal e manter carrinho
    const status = await __fetchStoreStatus();
    const isClosed = (status && (status.effectiveClosed === true || status.closedNow === true));
    if (isClosed) { __showClosedModal(status.reason, status.reopenAt); return false; }

    // Carrinho vazio? alert e fica
    let c = [];
    try { c = JSON.parse(localStorage.getItem('produto_cart')||'[]'); } catch(_) { c = []; }
    if (!Array.isArray(c) || c.length === 0) { alert('Seu carrinho está vazio.'); return false; }

    // Loja aberta e autenticado: ir para o Checkout protegido
    try {
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
      const aside = document.querySelector('aside');
      if (isMobile && aside) aside.classList.remove('show');
    } catch(_) {}
    window.location.href = '/checkout';
    return true;
  });
})();

// Se viemos redirecionados por fechamento da loja, abrir modal automaticamente
document.addEventListener('DOMContentLoaded', async ()=>{
  try {
    const url = new URL(window.location.href);
  const flagged = url.searchParams.get('closed') === '1' || localStorage.getItem('estab_trigger_closed_modal') === '1' || localStorage.getItem('pizzaria_trigger_closed_modal') === '1';
    if (!flagged) return;
    // limpar flag para não reabrir em navegações subsequentes
  try { localStorage.removeItem('pizzaria_trigger_closed_modal'); localStorage.removeItem('estab_trigger_closed_modal'); } catch(_) {}
    const status = await __fetchStoreStatus();
    const isClosed = (status && (status.effectiveClosed === true || status.closedNow === true));
    if (isClosed) {
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
  try {
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
    if (!isMobile) return; // em dispositivos maiores manter o carrinho sempre visível
    document.querySelector("aside")?.classList.remove("show");
  } catch(_) {}
});

// Aplicar configurações do Instagram salvas no admin
function applyInstagramSettings() {
  try {
    // If layout script already applied Instagram from DB, skip local overrides
    if (window.__layoutControlsInstagram) return;
  const instagramSettings = localStorage.getItem('estab_instagram') || localStorage.getItem('pizzaria_instagram');
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
  instagramLink.setAttribute('aria-label', `Instagram ${settings.handle || 'Estabelecimento'}`);
    }
    
  } catch (e) {
    console.warn('Erro ao aplicar configurações do Instagram:', e);
  }
}

// Aplicar configurações quando a página carregar
document.addEventListener('DOMContentLoaded', applyInstagramSettings);

// Escutar mudanças no localStorage para atualizar em tempo real
window.addEventListener('storage', (e) => {
  if (e.key === 'pizzaria_instagram' || e.key === 'estab_instagram') {
    applyInstagramSettings();
  }
});
