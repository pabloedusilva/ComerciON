// Sistema de Autenticação Frontend
class AuthSystem {
    constructor() {
        this.baseURL = '';
        this.token = this.getToken();
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.setupLogoutHandlers();
    }

    // Gerenciamento de Token
    getToken() {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }

    setToken(token, remember = false) {
        if (remember) {
            localStorage.setItem('auth_token', token);
        } else {
            sessionStorage.setItem('auth_token', token);
        }
        this.token = token;
    }

    removeToken() {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        this.token = null;
    }

    // Verificar se está logado
    isAuthenticated() {
        return !!this.token;
    }

    // Verificar status de autenticação
    async checkAuthStatus() {
        if (!this.token) return false;

        try {
            const response = await fetch('/api/customer/auth/perfil', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateUIForAuthenticatedUser(data.usuario);
                return true;
            } else {
                this.removeToken();
                return false;
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            return false;
        }
    }

    // Login de cliente
    async login(email, senha, remember = false) {
        try {
            const response = await fetch('/api/customer/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();

            if (response.ok) {
                this.setToken(data.token, remember);
                this.updateUIForAuthenticatedUser(data.usuario);
                return { success: true, user: data.usuario };
            } else {
                return { success: false, message: data.mensagem };
            }
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Registro de cliente
    async register(userData) {
        try {
            const response = await fetch('/api/customer/auth/registrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, message: data.mensagem };
            } else {
                return { success: false, message: data.mensagem };
            }
        } catch (error) {
            console.error('Erro no registro:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Logout
    async logout() {
        try {
            if (this.token) {
                await fetch('/api/customer/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('Erro no logout:', error);
        } finally {
            this.removeToken();
            this.updateUIForUnauthenticatedUser();
            // Redirecionar para home
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
    }

    // Login Admin
    async loginAdmin(email, senha) {
        try {
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('admin_token', data.token);
                window.location.href = '/admin';
                return { success: true };
            } else {
                return { success: false, message: data.mensagem };
            }
        } catch (error) {
            console.error('Erro no login admin:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Atualizar UI para usuário logado
    updateUIForAuthenticatedUser(user) {
        // Atualizar elementos de navegação
        const profileDropdowns = document.querySelectorAll('.profile-dropdown ul');
        profileDropdowns.forEach(dropdown => {
            const profileLink = dropdown.querySelector('a[href="#"]');
            if (profileLink && profileLink.textContent.includes('Meu Perfil')) {
                // Atualizar nome do usuário se disponível
                if (user && user.nome) {
                    profileLink.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${user.nome}`;
                }
            }
        });

        // Mostrar elementos autenticados
        this.toggleAuthElements(true);
    }

    // Atualizar UI para usuário não logado
    updateUIForUnauthenticatedUser() {
        this.toggleAuthElements(false);
    }

    // Alternar elementos baseado em autenticação
    toggleAuthElements(isAuthenticated) {
        // Elementos que só aparecem quando logado
        const authElements = document.querySelectorAll('[data-auth-required="true"]');
        authElements.forEach(el => {
            el.style.display = isAuthenticated ? '' : 'none';
        });

        // Elementos que só aparecem quando não logado
        const noAuthElements = document.querySelectorAll('[data-auth-required="false"]');
        noAuthElements.forEach(el => {
            el.style.display = isAuthenticated ? 'none' : '';
        });
    }

    // Configurar handlers de logout
    setupLogoutHandlers() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.logout')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    // Proteger rota (redirecionar se não autenticado)
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    // Proteger checkout
    checkoutProtection() {
        const checkoutBtn = document.querySelector('.checkout-btn, [data-checkout]');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', (e) => {
                if (!this.isAuthenticated()) {
                    e.preventDefault();
                    const shouldRedirect = confirm('Você precisa estar logado para finalizar a compra. Deseja fazer login agora?');
                    if (shouldRedirect) {
                        // Salvar carrinho atual
                        try {
                            const cart = localStorage.getItem('pizza_cart');
                            if (cart) {
                                localStorage.setItem('pizza_cart_backup', cart);
                            }
                        } catch (e) {}
                        
                        window.location.href = '/login?redirect=checkout';
                    }
                    return false;
                }
                return true;
            });
        }
    }
}

// Instanciar sistema de autenticação
const auth = new AuthSystem();

// Exportar para uso global
window.AuthSystem = auth;