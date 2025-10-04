// Preenche dinamicamente o bloco .user-profile com dados do admin logado e logo atual
(function(){
  const root = document.querySelector('.user-profile');
  if(!root) return;

  const LS_KEY = 'admin_token';
  const DEFAULT_LOGO = '/assets/images/default-images/default.png';

  function clearSkeleton(){
    root.classList.remove('loading');
    root.removeAttribute('aria-busy');
    root.querySelectorAll('.skeleton-text').forEach(el=>el.classList.remove('skeleton-text'));
    const avatar = root.querySelector('.skeleton-avatar');
    if (avatar) avatar.classList.remove('skeleton-avatar');
  }

  function setFallback(reason){
    // Mantém vazio (sem dados de exemplo). Apenas remove animação se quisermos parar loading.
    if (reason) console.debug('[userProfile] fallback (mantendo vazio):', reason);
  }

  async function load(){
    try {
      const token = localStorage.getItem(LS_KEY);
  if(!token){ setFallback('sem token'); return; }

      // Auth (usa Bearer compatível com middleware existente)
      const authResp = await fetch('/api/admin/auth/verificar', {
        headers:{
          'Accept':'application/json',
          'Cache-Control':'no-cache',
          'Authorization': `Bearer ${token}`
        }
      });
  if(!authResp.ok){ setFallback('authResp !ok'); return; }
      const authJson = await authResp.json();
  if(!authJson?.sucesso || !authJson.admin){ setFallback('json inesperado'); return; }
      const admin = authJson.admin;

      // Layout / logo
      let logoUrl = null;
      try {
        const layoutResp = await fetch('/api/public/layout', { headers:{'Accept':'application/json','Cache-Control':'no-cache'} });
        if(layoutResp.ok){
          const lj = await layoutResp.json();
            logoUrl = lj?.data?.logo_url || lj?.logo_url || null;
        }
      } catch(err){ console.debug('[userProfile] erro layout', err); }
  // Se não houver logo no banco, deixamos sem imagem visível (não aplicamos default agora)
  const hasRealLogo = !!logoUrl;
  if(!hasRealLogo) logoUrl = DEFAULT_LOGO; // agora sempre mostra default se não houver no banco

      // Avatar
      const imgEl = root.querySelector('.user-avatar img');
      if(imgEl){
        imgEl.style.opacity = '1';
        imgEl.src = logoUrl;
        imgEl.alt = admin.nome ? `Avatar de ${admin.nome}` : 'Avatar';
        imgEl.referrerPolicy = 'no-referrer';
        imgEl.decoding = 'async';
        imgEl.style.objectFit = 'cover';
        imgEl.onerror = () => {
          if(imgEl.dataset._retried) { imgEl.src = DEFAULT_LOGO; return; }
          imgEl.dataset._retried = '1';
          console.debug('[userProfile] logo erro - fallback default');
          imgEl.src = DEFAULT_LOGO;
        };
      }

      // Nome
      const nameEl = root.querySelector('.user-name');
  if (nameEl) nameEl.textContent = admin.nome || '';

      // Papel
      const roleEl = root.querySelector('.user-role');
      if (roleEl) {
        let roleLabel = '';
        if (admin.nivel_acesso === 'super_admin' || admin.super_admin) roleLabel = 'Super Admin';
        else if (admin.nivel_acesso) roleLabel = admin.nivel_acesso.replace(/_/g,' ').replace(/\b(\w)/g,c=>c.toUpperCase());
        roleEl.textContent = roleLabel;
      }

      const statusIndicator = root.querySelector('.status-indicator');
  if(statusIndicator){ statusIndicator.classList.add('online'); }
  clearSkeleton();

      try {
        sessionStorage.setItem('admin_user_profile', JSON.stringify({ t: Date.now(), admin:{nome:admin.nome, nivel_acesso:admin.nivel_acesso, super_admin:admin.super_admin}, logo: logoUrl }));
      } catch(_){ }
    } catch (e) {
    console.warn('[userProfile] erro geral', e);
    // Mantém skeleton carregando (caso seja erro transitório). Poderíamos adicionar timeout para remover.
    }
  }

  // Atraso pequeno para garantir que localStorage já tenha token setado por scripts anteriores (login -> redirect)
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(load, 30));
  } else {
    setTimeout(load, 30);
  }
})();
