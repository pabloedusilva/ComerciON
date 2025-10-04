// page-title.js - aplica título dinâmico e favicon com base nas configurações públicas
(function(){
  const DEFAULT_FAVICON = '/assets/images/favicon.ico';
  const SECTION_FALLBACK = '';
  function ensureFavicon(url){
    try {
      const head = document.head;
      // Remove favicons antigos
      [...head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].forEach(l=>l.parentNode.removeChild(l));
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/x-icon';
      link.href = url || DEFAULT_FAVICON;
      head.appendChild(link);
    } catch(e) { console.warn('Falha ao definir favicon', e); }
  }
  function detectSection(){
    // Permitir forçar via atributo data-page-section em <body>
    const forced = document.body.getAttribute('data-page-section');
    if (forced) return forced.trim();
    const path = window.location.pathname;
    if (/\/admin\//.test(path)) return 'admin';
    if (/\/menu/.test(path)) return 'cardápio';
    if (/\/sobre/.test(path)) return 'sobre';
    if (/\/checkout/.test(path)) return 'checkout';
    if (/\/pedidos/.test(path)) return 'pedidos';
    if (/\/login/.test(path) && /customer/.test(path)) return 'login';
    if (/\/cadastro/.test(path)) return 'cadastro';
    if (/\/perfil/.test(path)) return 'perfil';
    if (/\/success/.test(path)) return 'pagamento';
    if (/404/.test(path)) return '404';
    return SECTION_FALLBACK;
  }
  async function fetchSettings(){
    try {
      const res = await fetch('/api/public/settings');
      const json = await res.json();
      if (!res.ok || !json.sucesso) throw new Error(json.mensagem || 'Erro settings');
      return json.data || {};
    } catch(e){
      return {};
    }
  }
  async function apply(){
    const section = detectSection();
  const settings = await fetchSettings();
  const nome = settings?.name || settings?.store_name || settings?.nome_estabelecimento || 'Estabelecimento';
    let finalTitle = nome;
    if (section) {
      // Capitalizar primeira letra mantendo acentos
      finalTitle = `${nome} - ${section.charAt(0).toUpperCase()}${section.slice(1)}`;
    }
    document.title = finalTitle;
    ensureFavicon(DEFAULT_FAVICON);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
