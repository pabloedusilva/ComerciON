(function(){
  const LS_KEY = 'pizzaria_admin_session';
  const REDIRECT_URL = './admin.html';

  function isValidEmail(email){
    return /\S+@\S+\.\S+/.test(email);
  }

  function setLoading(btn, loading){
    if(!btn) return;
    if(loading){
      btn.classList.add('loading');
      btn.disabled = true;
      btn.textContent = 'Entrando...';
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  // Auto redirect if already logged
  try {
    const session = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (session && session.logged === true) {
      window.location.replace(REDIRECT_URL);
      return;
    }
  } catch(e) { /* ignore */ }

  // DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    const form = document.getElementById('adminLoginForm');
    const emailInput = document.getElementById('adminEmail');
    const passInput = document.getElementById('adminPassword');
    const emailError = document.getElementById('adminEmailError');
    const passError = document.getElementById('adminPasswordError');
    const submitBtn = document.getElementById('adminLoginSubmit');

    // Toggle password visibility
    const toggle = document.querySelector('.toggle-password');
    toggle?.addEventListener('click', function(){
      const isPassword = passInput.getAttribute('type') === 'password';
      passInput.setAttribute('type', isPassword ? 'text' : 'password');
      const icon = this.querySelector('i');
      icon?.classList.toggle('fa-eye');
      icon?.classList.toggle('fa-eye-slash');
    });

    form?.addEventListener('submit', function(e){
      e.preventDefault();
      // reset errors
      emailError.textContent = '';
      passError.textContent = '';

      let valid = true;
      const email = (emailInput.value || '').trim();
      const password = passInput.value || '';

      if (!isValidEmail(email)){
        emailError.textContent = 'Informe um e-mail válido.';
        valid = false;
      }
      if (!password || password.length < 6){
        passError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
        valid = false;
      }

      if (!valid) return;

      // Demo-only auth: any valid email/senha passes. No signup.
      setLoading(submitBtn, true);
      setTimeout(()=>{
        try {
          localStorage.setItem(LS_KEY, JSON.stringify({ logged: true, at: Date.now(), email }));
        } catch(e) { /* ignore */ }
        window.location.href = REDIRECT_URL;
      }, 900);
    });
  });
})();
