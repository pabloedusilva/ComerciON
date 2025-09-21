// Sistema de Login do Cliente
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const lembrarCheckbox = document.getElementById('lembrar');
    const loginBtn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    const successDiv = document.getElementById('loginSuccess');

    // Verificar se já está logado
    if (window.AuthSystem && window.AuthSystem.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    // Verificar parâmetros de URL para redirect
    const urlParams = new URLSearchParams(window.location.search);
    const redirectAfterLogin = urlParams.get('redirect');

    // Handler do formulário de login
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const senha = senhaInput.value;
            const lembrar = lembrarCheckbox ? lembrarCheckbox.checked : false;

            // Validação básica
            if (!email || !senha) {
                showError('Preencha todos os campos');
                return;
            }

            // Validação de email
            if (!isValidEmail(email)) {
                showError('Email inválido');
                return;
            }

            // Desabilitar botão durante login
            setLoadingState(true);

            try {
                const result = await window.AuthSystem.login(email, senha, lembrar);
                
                if (result.success) {
                    showSuccess('Login realizado com sucesso!');
                    
                    // Restaurar carrinho se necessário
                    try {
                        const backupCart = localStorage.getItem('pizza_cart_backup');
                        if (backupCart) {
                            localStorage.setItem('pizza_cart', backupCart);
                            localStorage.removeItem('pizza_cart_backup');
                        }
                    } catch (e) {}

                    // Redirecionar após login
                    setTimeout(() => {
                        if (redirectAfterLogin === 'checkout') {
                            window.location.href = '/menu?checkout=1';
                        } else {
                            window.location.href = '/';
                        }
                    }, 1500);
                } else {
                    showError(result.message || 'Erro no login');
                }
            } catch (error) {
                console.error('Erro no login:', error);
                showError('Erro de conexão');
            } finally {
                setLoadingState(false);
            }
        });
    }

    // Funções auxiliares
    function showError(message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
        if (successDiv) {
            successDiv.style.display = 'none';
        }
    }

    function showSuccess(message) {
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    function setLoadingState(loading) {
        if (loginBtn) {
            loginBtn.disabled = loading;
            loginBtn.textContent = loading ? 'Entrando...' : 'Entrar';
        }
        
        if (emailInput) emailInput.disabled = loading;
        if (senhaInput) senhaInput.disabled = loading;
        if (lembrarCheckbox) lembrarCheckbox.disabled = loading;
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Link para cadastro
    const cadastroLink = document.getElementById('cadastroLink');
    if (cadastroLink) {
        cadastroLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/cadastro';
        });
    }

    // Link "Esqueci minha senha"
    const esqueciSenhaLink = document.getElementById('esqueciSenha');
    if (esqueciSenhaLink) {
        esqueciSenhaLink.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Funcionalidade de recuperação de senha será implementada em breve!');
        });
    }
});