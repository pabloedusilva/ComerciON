// Login page logic (external, CSP-friendly)
(function(){
    function getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function togglePasswordVisibility() {
        const btn = document.querySelector('.toggle-password');
        if (!btn) return;
        btn.addEventListener('click', function(){
            const input = document.getElementById('password');
            const icon = this.querySelector('i');
            if (!input || !icon) return;
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }

    async function doLogin(){
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        const submitBtn = document.querySelector('.auth-submit');

        if (!email || !password || !emailError || !passwordError || !submitBtn) return;

        emailError.textContent = '';
        passwordError.textContent = '';

        let valid = true;
        if(!email.value || !/^\S+@\S+\.\S+$/.test(email.value)){
            emailError.textContent = 'Informe um e-mail válido.';
            valid = false;
        }
        if(!password.value || password.value.length < 6){
            passwordError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            valid = false;
        }
        if(!valid) return;

        try {
            submitBtn.classList.add('loading');
            submitBtn.textContent = 'Entrando...';
            submitBtn.disabled = true;

            const res = await fetch('/api/customer/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.value.trim(), senha: password.value })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.mensagem || 'Email ou senha incorretos');
            }

            if (window.AuthSystem && data.token) {
                window.AuthSystem.setToken(data.token, true);
                try { window.AuthSystem.setUser(data.usuario, true); } catch(_) {}
                window.AuthSystem.updateUIForAuthenticatedUser(data.usuario);
            } else if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }

            const redirect = getQueryParam('redirect');
            window.location.href = redirect || '/menu';
        } catch (err) {
            if (password) password.value = '';
            if (passwordError) passwordError.textContent = (err && err.message) ? err.message : 'Falha no login';
        } finally {
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.textContent = 'Entrar';
                submitBtn.disabled = false;
            }
        }
    }

    function init(){
        togglePasswordVisibility();
        const submitBtn = document.querySelector('.auth-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e){
                e.preventDefault();
                doLogin();
            });
        }
        const form = document.getElementById('loginForm');
        if (form) {
            form.setAttribute('method', 'POST');
            form.addEventListener('submit', function(e){ e.preventDefault(); doLogin(); });
            form.addEventListener('keydown', function(e){
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doLogin();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
