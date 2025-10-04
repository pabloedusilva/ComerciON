/* Global Image Fallback Utility
 * Aplica fallback 'default.png' para TODAS as imagens que falharem ou vierem vazias.
 * Regras:
 *  - Se <img> sem src ou src === '' ou apenas whitespace -> aplica default
 *  - Se erro de carregamento -> aplica default
 *  - Observa DOM dinâmico (MutationObserver)
 *  - Opt-out: adicionar atributo data-no-fallback="true"
 *  - Pode forçar outra imagem via data-fallback="/path/custom.png"
 */
(function(){
  // Caminho absoluto da imagem de fallback física
  const DEFAULT_PATH = '/assets/images/default-images/default.png';
  let resolvedDefault = DEFAULT_PATH; // Pode ser alterado em runtime

  function isEmptySrc(src){
    if(!src) return true;
    const s = String(src).trim();
    if(!s) return true;
    return false;
  }

  function apply(img){
    if(!img || img.dataset.noFallback === 'true') return;
  const custom = img.getAttribute('data-fallback');
  const target = (custom && custom.trim()) || resolvedDefault;
    if(img.getAttribute('data-fallback-applied') === '1') return;
    img.setAttribute('data-fallback-applied','1');
    img.src = target;
  }

  function enhance(img){
    if(!img || img.dataset._fallbackBound === '1') return;
    img.dataset._fallbackBound = '1';
    if(isEmptySrc(img.getAttribute('src'))){
      apply(img);
    }
    img.addEventListener('error', function(){
      apply(img);
    }, { passive: true });
  }

  function scan(root){
    (root || document).querySelectorAll('img').forEach(enhance);
  }

  // Initial
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => scan());
  } else {
    scan();
  }

  // Observe dynamic DOM changes
  const mo = new MutationObserver(muts => {
    for(const m of muts){
      m.addedNodes && m.addedNodes.forEach(node => {
        if(node.nodeType === 1){
          if(node.tagName === 'IMG') enhance(node);
          else scan(node);
        }
      });
    }
  });
  try { mo.observe(document.documentElement, { childList:true, subtree:true }); } catch(_){ }

  // Expor utilitário global opcional
  window.__ImageFallback = {
    applyTo: apply,
    rescan: () => scan(),
    setDefault: (path) => { if(path) resolvedDefault = path; scan(); },
    getDefault: () => resolvedDefault
  };
})();
