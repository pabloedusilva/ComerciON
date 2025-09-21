(function(){
  const LS_KEY = 'admin_token';
  const REDIRECT_URL = '/admin';
  let isSubmitting = false;

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

  function showError(element, message) {
    if (element) {
      element.textContent = message;
    }
  }

  function clearErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.textContent = '');
  }

  // Verificar se já está logado - APENAS UMA VEZ com verificação no backend
  (async function checkExistingAuth() {
    try {
      const token = localStorage.getItem(LS_KEY);
      if (token) {
        // Verificar se o token ainda é válido no backend
        const response = await fetch('/api/admin/auth/verificar', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          console.log('Token válido encontrado, redirecionando...');
          window.location.replace(REDIRECT_URL);
          return;
        } else {
          // Token inválido, limpar e continuar no login
          localStorage.clear();
          sessionStorage.clear();
        }
      }
    } catch(e) { 
      console.error('Erro ao verificar token:', e);
      localStorage.clear();
      sessionStorage.clear();
    }
  })();

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

    form?.addEventListener('submit', async function(e){
      e.preventDefault();
      
      if (isSubmitting) return;
      
      clearErrors();
      
      let valid = true;
      const email = (emailInput.value || '').trim();
      const password = passInput.value || '';

      if (!isValidEmail(email)){
        showError(emailError, 'Informe um e-mail válido.');
        valid = false;
      }
      if (!password || password.length < 6){
        showError(passError, 'A senha deve ter no mínimo 6 caracteres.');
        valid = false;
      }

      if (!valid) return;

      isSubmitting = true;
      setLoading(submitBtn, true);

      try {
        const response = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, senha: password })
        });

        const data = await response.json();

        if (response.ok && data.sucesso) {
          localStorage.setItem(LS_KEY, data.token);
          window.location.href = REDIRECT_URL;
        } else {
          showError(passError, data.mensagem || 'Erro no login. Verifique suas credenciais.');
        }
      } catch (error) {
        console.error('Erro no login:', error);
        showError(passError, 'Erro de conexão. Tente novamente.');
      } finally {
        isSubmitting = false;
        setLoading(submitBtn, false);
      }
    });
  });
})();
