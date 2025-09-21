// login.js - integra login com backend

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const submitBtn = form?.querySelector('.auth-submit');

  // Toggle de senha
  const toggle = document.querySelector('.toggle-password');
  toggle?.addEventListener('click', function(){
    const input = document.getElementById('password');
    const icon = this.querySelector('i');
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  });

  // Mensagem pós-cadastro
  if (new URLSearchParams(location.search).get('registered') === 'true') {
    try {
      const el = document.createElement('div');
      el.className = 'banner-success';
      el.style.cssText = 'background:#e7f8f1;color:#06734d;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:14px;border:1px solid #bfead9;';
      el.textContent = 'Conta criada! Faça login para continuar.';
      form?.parentElement?.insertBefore(el, form);
    } catch {}
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = !!loading;
    submitBtn.classList.toggle('loading', !!loading);
    submitBtn.textContent = loading ? 'Entrando...' : 'Entrar';
  }

  function setError(inputId, message) {
    const errorEl = document.getElementById(inputId + 'Error');
    if (errorEl) {
      errorEl.textContent = message || '';
      errorEl.style.display = message ? 'block' : 'none';
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('email', '');
    setError('password', '');

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('password').value;

    // validação simples
    let valid = true;
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('email', 'Informe um e-mail válido.'); valid = false; }
    if (!senha || senha.length < 6) { setError('password', 'A senha deve ter no mínimo 6 caracteres.'); valid = false; }
    if (!valid) return;

    setLoading(true);
    try {
      const data = await API.apiFetch('/customer/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha })
      });
      API.setToken(data.token);
      API.saveUser(data.cliente);
      // redireciona para o menu (URL amigável)
      window.location.href = '/menu';
    } catch (err) {
      const msg = (err && err.message) || 'Falha no login';
      // Se o backend reclamou do formato do e-mail, mostrar no campo de e-mail
      if (/email/i.test(msg)) {
        setError('email', msg);
      } else {
        setError('password', msg);
      }
    } finally {
      setLoading(false);
    }
  });
});
