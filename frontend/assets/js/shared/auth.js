// Sistema de Autenticação Frontend
class AuthSystem {
    constructor() {
        this.baseURL = '';
        this.token = this.getToken();
        this.user = this.getUser();
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.setupLogoutHandlers();
        // Ativar proteção de checkout globalmente (defesa em profundidade)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.checkoutProtection());
        } else {
            // DOM já pronto
            this.checkoutProtection();
        }
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

    // Gerenciar usuário (nome no dropdown)
    getUser() {
        try {
            const data = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
            return data ? JSON.parse(data) : null;
        } catch(_) { return null; }
    }

    setUser(user, remember = true) {
        try {
            const str = JSON.stringify(user || null);
            if (remember) {
                localStorage.setItem('auth_user', str);
            } else {
                sessionStorage.setItem('auth_user', str);
            }
            this.user = user || null;
        } catch(_) {}
    }

    removeUser() {
        try { localStorage.removeItem('auth_user'); } catch(_) {}
        try { sessionStorage.removeItem('auth_user'); } catch(_) {}
        this.user = null;
    }

    // Verificar se está logado
    isAuthenticated() {
        return !!this.token;
    }

    // Verificar status de autenticação
    async checkAuthStatus() {
        if (!this.token) {
            // Garantir UI consistente quando não autenticado
            this.updateUIForUnauthenticatedUser();
            return false;
        }

        try {
            const response = await fetch('/api/customer/auth/verificar', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                try { this.setUser(data.usuario, true); } catch(_) {}
                this.updateUIForAuthenticatedUser(data.usuario);
                return true;
            } else {
                this.removeToken();
                this.removeUser();
                this.updateUIForUnauthenticatedUser();
                return false;
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            this.updateUIForUnauthenticatedUser();
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
                try { this.setUser(data.usuario, true); } catch(_) {}
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
            this.removeUser();
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
        const dropdownRoots = document.querySelectorAll('.profile-dropdown ul');
        dropdownRoots.forEach(root => {
            root.querySelectorAll('[data-auth-required="true"]').forEach(li => li.style.display = '');
            root.querySelectorAll('[data-auth-required="false"]').forEach(li => li.style.display = 'none');
            const userItem = root.querySelector('a[href="/perfil"]');
            if (userItem && user && user.nome) {
                userItem.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${user.nome}`;
            }
        });
        this.toggleAuthElements(true);
    }

    // Atualizar UI para usuário não logado
    updateUIForUnauthenticatedUser() {
        const dropdownRoots = document.querySelectorAll('.profile-dropdown ul');
        dropdownRoots.forEach(root => {
            root.querySelectorAll('[data-auth-required="true"]').forEach(li => li.style.display = 'none');
            root.querySelectorAll('[data-auth-required="false"]').forEach(li => li.style.display = '');
        });
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
            const current = window.location.pathname + window.location.search + window.location.hash;
            window.location.href = '/login?redirect=' + encodeURIComponent(current);
            return false;
        }
        return true;
    }

    // Proteger checkout
    checkoutProtection() {
        const candidates = document.querySelectorAll('.cart--finalizar, .checkout-btn, [data-checkout]');
        if (!candidates || candidates.length === 0) return;
        candidates.forEach((btn) => {
            if (btn.getAttribute('data-auth-guarded') === '1') return;
            btn.setAttribute('data-auth-guarded', '1');
            btn.addEventListener('click', (e) => {
                if (!this.isAuthenticated()) {
                    e.preventDefault();
                    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                    try {
                        const cart = localStorage.getItem('produto_cart');
                        if (cart) localStorage.setItem('produto_cart_backup', cart);
                        localStorage.setItem('pizzaria_open_cart_on_load', '1');
                    } catch(_) {}
                    window.location.href = '/login?redirect=' + encodeURIComponent('/menu#checkout');
                    return false;
                }
                return true;
            }, { capture: true });
        });
    }
}

// Instanciar sistema de autenticação
const auth = new AuthSystem();

// Exportar para uso global
window.AuthSystem = auth;
