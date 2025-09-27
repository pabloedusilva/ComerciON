// Sistema de Autenticação Admin
(function(){
    const LS_KEY = 'admin_token';
    let checkingAuth = false;
    
    async function verificarAutenticacao() {
        if (checkingAuth) return;
        checkingAuth = true;
        
        try {
            const token = localStorage.getItem(LS_KEY);
            
            if (!token) {
                redirecionarParaLogin();
                return;
            }

            const response = await fetch('/api/admin/auth/verificar', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                localStorage.removeItem(LS_KEY);
                redirecionarParaLogin();
                return;
            }

            // Verificar se é super admin para mostrar seção de desenvolvedor
            const data = await response.json();
            if (data.admin && data.admin.super_admin) {
                mostrarSecaoDesenvolvedor();
            }
            
        } catch (error) {
            console.error('Erro na autenticação:', error);
            localStorage.removeItem(LS_KEY);
            redirecionarParaLogin();
        } finally {
            checkingAuth = false;
        }
    }

    async function mostrarSecaoDesenvolvedor() {
        try {
            // Dupla verificação de segurança - revalidar super_admin
            const token = localStorage.getItem(LS_KEY);
            const response = await fetch('/api/admin/auth/verificar', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) return;
            const data = await response.json();
            if (!data.admin?.super_admin) return;

            // Mostrar navegação da seção desenvolvedor
            const developerNavSection = document.getElementById('developer-nav-section');
            if (developerNavSection) {
                developerNavSection.style.display = 'block';
            }

            // Habilitar CSS da seção desenvolvedor (lazy loading)
            const developerStyles = document.getElementById('developer-styles');
            if (developerStyles) {
                developerStyles.disabled = false;
            }

            // Configurar evento de clique para lazy load do JavaScript
            setupDeveloperSectionLazyLoad();
            
        } catch (error) {
            console.error('Erro ao verificar acesso de desenvolvedor:', error);
        }
    }

    let developerScriptLoaded = false;
    let developerSectionInitialized = false;

    function setupDeveloperSectionLazyLoad() {
        const developerNav = document.querySelector('.developer-nav');
        if (!developerNav) return;

        developerNav.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Verificação tripla de segurança antes de carregar
            if (!(await verificarSuperAdminAccess())) {
                alert('Acesso negado. Apenas Super Admins podem acessar esta seção.');
                return;
            }

            // Carregar script dinamicamente (apenas uma vez)
            if (!developerScriptLoaded) {
                await loadDeveloperScript();
                developerScriptLoaded = true;
            }

            // Mostrar seção e inicializar
            mostrarSecaoDesenvolvimento();
        });
    }

    async function verificarSuperAdminAccess() {
        try {
            const token = localStorage.getItem(LS_KEY);
            const response = await fetch('/api/admin/auth/verificar', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) return false;
            const data = await response.json();
            return data.admin?.super_admin === true;
        } catch (error) {
            console.error('Erro na verificação de super admin:', error);
            return false;
        }
    }

    function loadDeveloperScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '../../assets/js/admin/developer.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar script de desenvolvedor'));
            document.head.appendChild(script);
        });
    }

    function mostrarSecaoDesenvolvimento() {
        // Usar o sistema de navegação existente
        showSection('developer');
        
        // Inicializar seção apenas uma vez
        if (!developerSectionInitialized && window.initDeveloperSection) {
            window.initDeveloperSection();
            developerSectionInitialized = true;
        }
    }

    function redirecionarParaLogin() {
        const isLoginPage = window.location.pathname.includes('admin-login');
        if (!isLoginPage) {
            window.location.replace('/admin-login');
        }
    }

    // Verificar autenticação apenas se não estiver na página de login
    const isLoginPage = window.location.pathname.includes('admin-login');
    if (!isLoginPage) {
        verificarAutenticacao();
    }

    // Função global de logout com segurança total
    window.__adminLogout = async function(){
        try {
            const token = localStorage.getItem(LS_KEY);
            
            if (token) {
                // Chamar endpoint de logout do backend para invalidar sessão
                await fetch('/api/admin/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
            }
        } catch (error) {
            console.error('Erro ao fazer logout no backend:', error);
        }
        
        // Limpar completamente o localStorage
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_permissions');
        localStorage.clear(); // Limpar tudo para garantir
        
        // Limpar sessionStorage também
        sessionStorage.clear();
        
        // Adicionar proteção contra voltar do navegador
        history.pushState(null, null, '/admin-login');
        window.addEventListener('popstate', function(event) {
            window.location.replace('/admin-login');
        });
        
        // Forçar redirecionamento para login
        window.location.replace('/admin-login');
    };

    // Vincular o clique do botão de logout via JS (evita inline bloqueado por CSP)
    document.addEventListener('DOMContentLoaded', function(){
        const logoutButtons = document.querySelectorAll('.btn-logout');
        logoutButtons.forEach(btn => {
            btn.addEventListener('click', function(e){
                e.preventDefault();
                if (window.__adminLogout) {
                    window.__adminLogout();
                }
            });
        });
    });

    // Delegação global (resiliência): funciona mesmo se o botão for recriado dinamicamente
    document.addEventListener('click', function(e){
        const target = e.target.closest('.btn-logout');
        if (target) {
            e.preventDefault();
            if (window.__adminLogout) {
                window.__adminLogout();
            }
        }
    }, true);

    // Proteção adicional contra voltar do navegador após logout
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            // Página foi carregada do cache (botão voltar)
            const token = localStorage.getItem(LS_KEY);
            if (!token) {
                window.location.replace('/admin-login');
            }
        }
    });
})();

// Estado global da aplicação
let currentSection = 'dashboard';

// Loader overlay helpers for Admin SPA
function showLoaderOverlay() {
    const el = document.querySelector('.loader-content');
    if (el) el.classList.add('show');
}
function hideLoaderOverlay() {
    const el = document.querySelector('.loader-content');
    if (el) el.classList.remove('show');
}
let products = [];
let orders = [];
let clients = [];
let charts = {};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    loadProductsFromAPI();
    setupEventListeners();
    setupCharts();
    loadDataFromAPI();
    showSection('dashboard');
    setupModernSidebar(); // Adicionar configuração da sidebar moderna
    
    // Configurar layout inicial baseado no tamanho da tela
    handleResize();
    
    // Adicionar loading overlay inicial se necessário
    removeLoadingState();

    // Iniciar status dinâmico no header da sidebar
    initSidebarStatusPill();
    
    // Inicializar sistema de data e hora
    initDateTimeSystem();
    // Quando a hora for sincronizada, refazer a consulta do gráfico com base na API
    try {
        window.addEventListener('timeSynced', () => {
            const filter = document.querySelector('#dashboard-section .chart-header .chart-filter');
            if (filter) {
                const event = new Event('change');
                filter.dispatchEvent(event);
            }
        });
    } catch(_) {}
    // Após pequena espera para permitir primeira sincronização, atualizar gráfico conforme filtro atual
    setTimeout(() => {
        try {
            const filter = document.querySelector('#dashboard-section .chart-header .chart-filter');
            if (filter) {
                const event = new Event('change');
                filter.dispatchEvent(event);
            }
        } catch(_) {}
    }, 800);
    
    // Inicializar reviews manager
    reviewsManager.init();
    reviewsManager.updateSummary();
    
    // Inicializar modal de confirmação
    confirmModal.init();
    
    // Inicializar statusManager globalmente para garantir que esteja disponível
    try {
        statusManager.load();
        console.log('App inicializada, statusManager:', statusManager.state);
    } catch (e) {
        console.warn('Erro ao carregar statusManager:', e);
    }

    // Iniciar atualização do badge de pedidos em tempo real
    startOrdersBadgePolling();

    // Iniciar atualização da dashboard em tempo real
    startDashboardPolling();
}

// Configuração da sidebar moderna
function setupModernSidebar() {
    // Adicionar efeito ripple nos links (simplificado)
    document.querySelectorAll('.nav-link, .btn-logout').forEach(element => {
        element.addEventListener('click', function(e) {
            createRipple(e, this);
        });
    });
    
    // Animação suave ao carregar
    setTimeout(() => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.animation = 'slideInRight 0.4s ease-out';
        }
    }, 100);
    
    // Hover effects simplificados nos ícones
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.nav-icon');
            if (icon) {
                icon.style.transition = 'background-color 0.2s ease';
            }
        });
    });
}

// Atualizador do status na sidebar (tempo real)
function initSidebarStatusPill() {
    const pill = document.getElementById('sidebarStatusPill');
    if (!pill) return;

    // Estado inicial de carregamento
    pill.classList.add('loading');
    pill.classList.remove('open', 'closed');
    pill.innerHTML = '<i class="fas fa-circle"></i> Carregando...';
    pill.setAttribute('title', 'Verificando status da loja');
    pill.setAttribute('aria-label', 'Verificando status da loja');

    const update = () => {
        // garantir que statusManager tenha estado carregado
        try { statusManager.load?.(); } catch(e) {}
        const closed = safeIsClosedNow();
        
        // Remover estado de carregamento e aplicar o real
        pill.classList.remove('loading', 'closed', 'open');
        pill.classList.add(closed ? 'closed' : 'open');
        pill.innerHTML = closed ? '<i class="fas fa-circle"></i> Fechada' : '<i class="fas fa-circle"></i> Aberta';
        pill.setAttribute('title', closed ? 'Loja fechada' : 'Loja aberta');
        pill.setAttribute('aria-label', closed ? 'Loja fechada' : 'Loja aberta');
    };

    // Helper seguro para não depender de seção ativa
    function safeIsClosedNow() {
        try {
            const now = new Date();
            if (statusManager && typeof statusManager.isClosedAt === 'function') {
                // garantir que horas existam
                if (!statusManager.state?.hours) {
                    statusManager.state = statusManager.state || {};
                    statusManager.state.hours = statusManager.getDefaultHours();
                }
                return !!statusManager.isClosedAt(now);
            }
        } catch (e) { /* noop */ }
        return false;
    }

    // Aguardar um momento para carregar o estado real
    setTimeout(update, 500);

    // Atualizar a cada minuto para refletir mudanças de horário
    setInterval(update, 60 * 1000);

    // Atualizar quando localStorage mudar (outra aba/parte do app)
    window.addEventListener('storage', (e) => {
        if (e.key === 'pizzaria_status') update();
    });

    // Não mais interceptar o statusManager.save aqui
    // A sidebar será atualizada pelos botões específicos no statusManager
}

// ===== Badge de Pedidos (tempo real) =====
const ACTIVE_ORDER_STATUSES = new Set(['pendente', 'preparando', 'a_caminho']);
let __ordersBadgeInterval = null;
let __ordersBadgeRefreshing = false;

function getOrdersBadgeElement() {
    return document.querySelector('a.nav-link[data-section="pedidos"] .badge');
}

// ===== Dashboard em tempo real =====
let __dashboardInterval = null;
let __dashboardLoading = false;

// ===== WebSocket (Socket.IO) =====
let __socket = null;
function initAdminSocket() {
    try {
        // Evitar múltiplas conexões
        if (__socket?.connected) return;
        const token = localStorage.getItem('admin_token');
        if (!token || typeof io !== 'function') return;
        __socket = io('/admin', { auth: { token } });

        __socket.on('connect', () => {
            // console.log('WS conectado (admin)');
        });
        __socket.on('disconnect', () => {
            // console.log('WS desconectado');
        });

        // Quando um pedido é criado, atualizar badge e dashboard e notificar
        __socket.on('order:created', async (payload) => {
            refreshOrdersBadgeFromAPI();
            refreshDashboardFromAPI();
            updateReportsCharts();
            try {
                if (window.notifications && payload && typeof payload === 'object') {
                    window.notifications.handleOrderCreated(payload);
                }
            } catch(_) {}
        });
        // Quando um pedido é atualizado, atualizar badge e dashboard
        __socket.on('order:updated', () => {
            refreshOrdersBadgeFromAPI();
            refreshDashboardFromAPI();
            updateReportsCharts();
        });

        // Pedido para atualizar tudo (dashboard:update)
        __socket.on('dashboard:update', () => {
            refreshDashboardFromAPI();
            updateReportsCharts();
        });
    } catch (e) {
        // silencioso
    }
}

function startDashboardPolling() {
    // Atualiza imediatamente
    refreshDashboardFromAPI();
    // Polling a cada 15s
    if (__dashboardInterval) return;
    __dashboardInterval = setInterval(refreshDashboardFromAPI, 15000);
}

async function refreshDashboardFromAPI() {
    if (__dashboardLoading) return;
    __dashboardLoading = true;
    try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        const resp = await fetch('/api/admin/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await resp.json();
        if (!resp.ok || !json?.sucesso) throw new Error(json?.mensagem || 'Falha ao carregar dashboard');
        applyDashboardData(json.data);
    } catch (e) {
        console.warn('Dashboard refresh falhou:', e.message);
    } finally {
        __dashboardLoading = false;
    }
}

function applyDashboardData(data) {
    if (!data) return;
    const { stats, recentOrders, popularProducts, series } = data;
    try { updateStatCards(stats); } catch (_) {}
    try { updateRecentOrders(recentOrders); } catch (_) {}
    try { updatePopularProducts(popularProducts); } catch (_) {}
    // Não atualizar o gráfico aqui para não sobrescrever o período escolhido pelo usuário.
    // O gráfico será atualizado apenas via filtro (reports API) usando a hora da API.
}

function updateStatCards(stats) {
    if (!stats) return;
    const cards = document.querySelectorAll('#dashboard-section .stat-card');
    // Esperado: 0 receita, 1 pedidos, 2 novos clientes, 3 produtos ativos
    const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v||0));
    const setCard = (idx, value, trend, label) => {
        const card = cards[idx];
        if (!card) return;
        const h3 = card.querySelector('.stat-info h3');
        const p = card.querySelector('.stat-info p');
        const span = card.querySelector('.stat-trend');
        if (idx === 0) h3.textContent = formatCurrency(value);
        else h3.textContent = String(value || 0);
        if (label) p.textContent = label;
        if (span) {
            const t = Number(trend || 0);
            span.textContent = `${t >= 0 ? '+' : ''}${t.toFixed(1)}%`;
            span.classList.remove('positive','negative','neutral');
            span.classList.add(t > 0 ? 'positive' : t < 0 ? 'negative' : 'neutral');
        }
    };
    setCard(0, stats.receita_mes, stats.tendencia?.receita, 'Receita do Mês');
    setCard(1, stats.pedidos_mes, stats.tendencia?.pedidos, 'Pedidos do Mês');
    setCard(2, stats.novos_clientes_mes, stats.tendencia?.clientes, 'Novos Clientes');
    setCard(3, stats.produtos_ativos, 0, 'Produtos Ativos');
}

function updateRecentOrders(list) {
    const cont = document.querySelector('#dashboard-section .recent-orders .orders-list');
    if (!cont) return;
    cont.innerHTML = '';
    const statusText = {
        pendente: 'Pendente',
        preparando: 'Preparando',
        a_caminho: 'A caminho',
        entregue: 'Entregue',
        cancelado: 'Cancelado'
    };
    const items = Array.isArray(list) ? list.slice(0, 4) : [];
    items.forEach(o => {
        const wrap = document.createElement('div');
        wrap.className = 'order-item';
        const cliente = (o.cliente || '\u2014').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const totalTxt = 'R$ ' + (Number(o.total)||0).toFixed(2);
        wrap.innerHTML = `
            <div class="order-left">
                <div class="order-row">
                    <strong class="order-id">#${o.id}</strong>
                    <span class="order-customer" title="${cliente}">${cliente}</span>
                </div>
                <div class="order-meta"><span class="order-time">${formatRelativeTime(o.data)}</span></div>
            </div>
            <div class="order-right">
                <span class="order-status ${o.status}">${statusText[o.status] || '\u2014'}</span>
                <span class="order-value">${totalTxt}</span>
            </div>
        `;
        cont.appendChild(wrap);
    });
}

function updatePopularProducts(list) {
    const grid = document.querySelector('#dashboard-section .popular-products .products-grid');
    if (!grid) return;
    grid.innerHTML = '';
    (list||[]).forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="../../assets/images/default-images/pizza-desenho.png" alt="${p.name}">
            <div class="product-info">
                <h4>${p.name}</h4>
                <p>${p.vendas} vendas</p>
                <span class="product-revenue">R$ ${(Number(p.receita)||0).toFixed(2)}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateSalesChart(series) {
    if (!series) return;
    const salesCtx = document.getElementById('salesChart');
    if (!salesCtx) return;
    if (!window.charts) window.charts = {};
    // Atualiza chart existente sem recriar (mais suave)
    if (charts.sales) {
        // Confiar nos rótulos enviados pelo backend (já no formato correto baseado na hora da API)
        charts.sales.data.labels = (Array.isArray(series.labels) ? series.labels : []);
        charts.sales.data.datasets[0].data = series.data;
        charts.sales.update('none');
    }
}

function formatRelativeTime(dateStr) {
    try {
        const date = new Date(dateStr);
        const now = (typeof dateTimeSystem?.getCurrentTime === 'function') ? dateTimeSystem.getCurrentTime() : new Date();
        const diffMs = now.getTime() - date.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `há ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `há ${hours} h`;
        const days = Math.floor(hours / 24);
        return `há ${days} d`;
    } catch (_) {
        return '';
    }
}

function computeActiveOrdersCount(list) {
    if (!Array.isArray(list)) return 0;
    return list.reduce((acc, o) => acc + (ACTIVE_ORDER_STATUSES.has(o.status) ? 1 : 0), 0);
}

function updateOrdersBadge(count) {
    const el = getOrdersBadgeElement();
    if (!el) return;
    const n = Number(count) || 0;
    el.textContent = String(n);
    if (n > 0) {
        el.classList.add('pulse-badge');
    } else {
        el.classList.remove('pulse-badge');
    }
}

function updateOrdersBadgeFromLocal() {
    try {
        updateOrdersBadge(computeActiveOrdersCount(orders));
    } catch (_) {}
}

async function refreshOrdersBadgeFromAPI() {
    if (__ordersBadgeRefreshing) return;
    __ordersBadgeRefreshing = true;
    try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        const resp = await fetch('/api/admin/orders', { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await resp.json().catch(() => null);
        const rows = Array.isArray(json?.data) ? json.data : [];
        // Não sobrescreve a UI inteira; apenas atualiza o badge com base na resposta
        const count = rows.reduce((acc, o) => acc + (ACTIVE_ORDER_STATUSES.has(o.status) ? 1 : 0), 0);
        updateOrdersBadge(count);
    } catch (_) {
        // silencioso
    } finally {
        __ordersBadgeRefreshing = false;
    }
}

function startOrdersBadgePolling() {
    // Atualiza imediatamente com dados locais já carregados
    updateOrdersBadgeFromLocal();
    // Uma primeira atualização vinda da API
    refreshOrdersBadgeFromAPI();
    // Inicia polling se ainda não estiver rodando
    if (__ordersBadgeInterval) return;
    __ordersBadgeInterval = setInterval(refreshOrdersBadgeFromAPI, 15000); // 15s
}

// Inicializar WebSocket após DOM pronto
document.addEventListener('DOMContentLoaded', () => {
    initAdminSocket();
    // Inicializa o novo módulo de notificações (separado e organizado)
    try { if (window.notifications && typeof window.notifications.init === 'function') { window.notifications.init(); } } catch(_) {}
    // Ensure Dashboard "Ver todos os pedidos" navigates within SPA
    const viewAllBtn = document.querySelector('#dashboard-section .view-all-btn');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            try { showSection('pedidos'); } catch (_) {}
            const el = document.getElementById('pedidos-section');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
});

// Sistema de Data e Hora em Tempo Real
const dateTimeSystem = {
    apiUrl: 'https://worldtimeapi.org/api/timezone/America/Sao_Paulo',
    updateInterval: 60000, // Atualizar a cada 1 minuto
    syncInterval: 3600000, // Sincronizar com API a cada 1 hora
    offsetFromServer: 0,
    lastSync: null,
    utcOffsetString: null, // e.g. -03:00
    
    init() {
        this.syncWithAPI();
        this.startUpdateLoop();
        this.startSyncLoop();
    },
    
    async syncWithAPI() {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) throw new Error('API response not ok');
            
            const data = await response.json();
            const serverTime = new Date(data.datetime);
            const localTime = new Date();
            
            // Calcular diferença entre servidor e local
            this.offsetFromServer = serverTime.getTime() - localTime.getTime();
            // Guardar utc_offset fornecido pela API (ex.: "-03:00")
            this.utcOffsetString = data.utc_offset || null;
            this.lastSync = new Date();
            
            console.log('DateTime sincronizado com API:', {
                serverTime: serverTime.toISOString(),
                localTime: localTime.toISOString(),
                offset: this.offsetFromServer,
                utcOffset: this.utcOffsetString
            });
            
            // Atualizar display imediatamente
            this.updateDisplay();
            // Notificar listeners que o horário foi sincronizado
            try {
                window.dispatchEvent(new CustomEvent('timeSynced', { detail: { offsetMs: this.offsetFromServer, utcOffset: this.utcOffsetString } }));
            } catch(_) {}
            
        } catch (error) {
            console.warn('Erro ao sincronizar com API de horário:', error);
            // Em caso de erro, usar horário local
            this.offsetFromServer = 0;
            this.updateDisplay();
        }
    },
    
    getCurrentTime() {
        const now = new Date();
        return new Date(now.getTime() + this.offsetFromServer);
    },

    // Retorna o offset em minutos relativo ao UTC conforme a API de tempo
    getTzOffsetMinutes() {
        if (typeof this.utcOffsetString === 'string' && /^[-+]\d{2}:\d{2}$/.test(this.utcOffsetString)) {
            const sign = this.utcOffsetString.startsWith('-') ? -1 : 1;
            const [hh, mm] = this.utcOffsetString.slice(1).split(':').map(n => parseInt(n, 10));
            return sign * (hh * 60 + mm);
        }
        // Fallback: calcular pelo Date local ajustado
        const now = this.getCurrentTime();
        return -now.getTimezoneOffset();
    },
    
    updateDisplay() {
        const dateElement = document.getElementById('dateText');
        const timeElement = document.getElementById('timeText');
        
        if (!dateElement || !timeElement) return;
        
        const now = this.getCurrentTime();
        
        // Formatar data (ex: "20 Set 2025")
        const dateStr = now.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        
        // Formatar hora (ex: "14:30")
        const timeStr = now.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        dateElement.textContent = dateStr;
        timeElement.textContent = timeStr;
    },
    
    startUpdateLoop() {
        // Atualizar display a cada minuto
        setInterval(() => {
            this.updateDisplay();
        }, this.updateInterval);
    },
    
    startSyncLoop() {
        // Sincronizar com API a cada hora
        setInterval(() => {
            this.syncWithAPI();
        }, this.syncInterval);
        
        // Também sincronizar quando a aba ganha foco (caso tenha ficado inativa por muito tempo)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.lastSync) {
                const timeSinceLastSync = Date.now() - this.lastSync.getTime();
                // Se passou mais de 30 minutos, sincronizar novamente
                if (timeSinceLastSync > 1800000) {
                    this.syncWithAPI();
                }
            }
        });
    }
};

// Função para inicializar o sistema de data e hora
function initDateTimeSystem() {
    dateTimeSystem.init();
}

// Função para criar efeito ripple
function createRipple(event, element) {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Remover estado de carregamento
function removeLoadingState() {
    const loadingElements = document.querySelectorAll('.loading, .skeleton');
    loadingElements.forEach(element => {
        element.classList.remove('loading', 'skeleton');
    });
}

// Carregar produtos do backend
async function loadProductsFromAPI() {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/admin/products', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        const result = await response.json();
        if (!response.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao carregar produtos');
        products = result.data || [];
        renderProductsTable();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        products = [];
        renderProductsTable(); // render vazio
    }
}

// Carregar dados reais da API (pedidos e clientes)
async function loadDataFromAPI() {
    // Pedidos: carregar do backend
    try {
        const token = localStorage.getItem('admin_token');
        const resp = await fetch('/api/admin/orders', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        const result = await resp.json();
        if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao carregar pedidos');
        const rows = Array.isArray(result.data) ? result.data : [];
        orders = rows.map(o => ({
            id: String(o.id),
            status: o.status,
            data: o.data,
            cliente: o.cliente || '—',
            telefone: o.telefone || '—',
            endereco: (o.endereco && o.endereco.trim()) ? o.endereco : '—',
            total: Number(o.total) || 0,
            items: Array.isArray(o.items) ? o.items.map(it => ({ nome: it.nome, quantidade: it.quantidade, preco: Number(it.preco) })) : []
        }));
    } catch (e) {
        console.warn('Pedidos: usando fallback vazio. Motivo:', e.message);
        orders = [];
    }
    renderOrdersTable();
    if (document.body.classList.contains('orders-fullscreen')) {
        renderOrdersCards();
    }
    updateOrdersBadgeFromLocal();
    // Clientes: buscar do backend real protegido
    try {
        const token = localStorage.getItem('admin_token');
        const resp = await fetch('/api/admin/customers', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        const result = await resp.json();
        if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao carregar clientes');
        const rows = Array.isArray(result.data) ? result.data : [];
        // Map para o formato esperado com agregados vindos do backend
        clients = rows.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            telefone: u.telefone || '—',
            pedidos: Number(u.pedidos ?? 0),
            totalGasto: Number(u.total_gasto ?? 0),
            ultimoPedido: u.ultimo_pedido || null,
            endereco: {
                rua: u.endereco || '',
                numero: '',
                bairro: '',
                cidade: u.cidade || '',
                estado: u.estado || '',
                cep: u.cep || '',
                complemento: ''
            },
            preferenciaSabores: []
        }));
    } catch (e) {
        console.warn('Clientes: usando fallback vazio. Motivo:', e.message);
        clients = [];
    }
    renderClientsTable();
}

// Carregar apenas clientes (para seção Clientes)
async function loadCustomersFromAPI() {
    try {
        const token = localStorage.getItem('admin_token');
        const resp = await fetch('/api/admin/customers', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        const result = await resp.json();
        if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao carregar clientes');
        const rows = Array.isArray(result.data) ? result.data : [];
        clients = rows.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            telefone: u.telefone || '—',
            pedidos: Number(u.pedidos ?? 0),
            totalGasto: Number(u.total_gasto ?? 0),
            ultimoPedido: u.ultimo_pedido || null,
            endereco: {
                rua: u.endereco || '',
                numero: '',
                bairro: '',
                cidade: u.cidade || '',
                estado: u.estado || '',
                cep: u.cep || '',
                complemento: ''
            },
            preferenciaSabores: []
        }));
    } catch (e) {
        console.warn('Clientes: usando fallback vazio. Motivo:', e.message);
        clients = [];
    }
    renderClientsTable();
}

// Configuração de event listeners - Melhorada para responsividade
function setupEventListeners() {
    // Navegação da sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            showSection(section);
            
            // Atualizar link ativo
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Fechar sidebar em mobile após seleção
            if (window.innerWidth <= 768) {
                closeMobileSidebar();
            }
        });
    });

    // Toggle sidebar
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');

    // Ambos os botões fazem a mesma ação: toggle da sidebar mobile
    sidebarToggle?.addEventListener('click', () => {
        toggleMobileSidebar();
    });

    mobileMenuToggle?.addEventListener('click', () => {
        toggleMobileSidebar();
    });

    // Configurar swipe gestures para mobile
    setupMobileGestures();
    
    // Configurar eventos de redimensionamento
    setupResizeHandlers();

    // Modais
    setupModals();

    // Botões de ação
    document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
    document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => loadDataFromAPI());
    
    // Fullscreen toggle for orders
    setupOrdersFullscreen();

    // Filtros
    setupFilters();

    // Período dos relatórios
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateReportsCharts();
        });
    });

    // Formulários de configuração
    setupConfigForms();
}

// Configurar fullscreen para pedidos
function setupOrdersFullscreen() {
    const fullscreenBtn = document.getElementById('ordersFullscreenToggle');
    if (!fullscreenBtn) return;

    let isFullscreen = false;

    function toggleFullscreen() {
        isFullscreen = !isFullscreen;
        const body = document.body;
        const icon = fullscreenBtn.querySelector('i');

        if (isFullscreen) {
            body.classList.add('orders-fullscreen');
            icon.className = 'fas fa-compress';
            fullscreenBtn.title = 'Sair da tela cheia';
            // Render orders as cards when entering fullscreen
            renderOrdersCards();
        } else {
            body.classList.remove('orders-fullscreen');
            icon.className = 'fas fa-expand';
            fullscreenBtn.title = 'Visualizar em tela cheia';
        }
    }

    // Click handler
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFullscreen) {
            toggleFullscreen();
        }
    });

    // Prevent page scroll when in fullscreen
    document.addEventListener('keydown', (e) => {
        if (isFullscreen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ')) {
            // Allow scrolling within the orders section only
            const ordersSection = document.getElementById('pedidos-section');
            if (ordersSection && !ordersSection.contains(e.target)) {
                e.preventDefault();
            }
        }
    });
}

// Configurar gestos móveis
function setupMobileGestures() {
    const sidebar = document.querySelector('.sidebar');
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    // Touch events para swipe na sidebar
    document.addEventListener('touchstart', (e) => {
        if (window.innerWidth <= 768) {
            startX = e.touches[0].clientX;
            
            // Se começar da borda esquerda, pode ser um swipe para abrir
            if (startX < 20 && !sidebar.classList.contains('mobile-open')) {
                isDragging = true;
            }
            // Se a sidebar estiver aberta e tocar fora dela
            else if (sidebar.classList.contains('mobile-open') && startX > 280) {
                closeMobileSidebar();
            }
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || window.innerWidth > 768) return;
        
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        
        // Swipe para a direita para abrir
        if (diff > 50 && !sidebar.classList.contains('mobile-open')) {
            openMobileSidebar();
            isDragging = false;
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        isDragging = false;
    }, { passive: true });
}

// Configurar handlers de redimensionamento
function setupResizeHandlers() {
    let resizeTimer;
    
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            handleResize();
        }, 250);
    });
    
    // Escutar mudanças de orientação em mobile
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            handleResize();
        }, 500);
    });
}

// Manipular redimensionamento
function handleResize() {
    const sidebar = document.querySelector('.sidebar');
    
    // Fechar sidebar mobile se redimensionar para desktop
    if (window.innerWidth > 768 && sidebar.classList.contains('mobile-open')) {
        closeMobileSidebar();
    }
    
    // Redimensionar gráficos
    resizeCharts();
    
    // Atualizar layout de tabelas
    updateTableLayout();
}

// Gerenciar sidebar mobile
function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebar.classList.contains('mobile-open')) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}

function openMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    
    // Criar overlay se não existir
    if (!document.querySelector('.sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', closeMobileSidebar);
        document.body.appendChild(overlay);
    }
    
    sidebar.classList.add('mobile-open');
    document.querySelector('.sidebar-overlay').classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevenir scroll do body
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('mobile-open');
    overlay?.classList.remove('show');
    document.body.style.overflow = ''; // Restaurar scroll do body
    
    // Remover overlay após animação
    setTimeout(() => {
        if (overlay && !overlay.classList.contains('show')) {
            overlay.remove();
        }
    }, 300);
}

// Redimensionar gráficos
function resizeCharts() {
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
}

// Atualizar layout de tabelas
function updateTableLayout() {
    const tables = document.querySelectorAll('.products-table, .orders-table, .clients-table');
    
    tables.forEach(tableContainer => {
        const table = tableContainer.querySelector('table');
        if (!table) return;
        
        // Envolver tabela em wrapper se necessário
        if (!table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
        
        // Em mobile, mostrar versão de cards se disponível
        if (window.innerWidth <= 768) {
            showMobileCards(tableContainer);
        } else {
            showDesktopTable(tableContainer);
        }
    });
}

// Mostrar cards mobile
function showMobileCards(tableContainer) {
    const table = tableContainer.querySelector('table');
    const existingCards = tableContainer.querySelector('.mobile-cards');
    
    if (existingCards) {
        existingCards.style.display = 'block';
        table.style.display = 'none';
        return;
    }
    
    // Criar cards mobile baseados na tabela
    const mobileCards = document.createElement('div');
    mobileCards.className = 'mobile-cards';
    
    const tbody = table.querySelector('tbody');
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
    
    Array.from(tbody.querySelectorAll('tr')).forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll('td'));
        
        const card = document.createElement('div');
        card.className = 'mobile-card';
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'mobile-card-header';
        
        const cardTitle = document.createElement('div');
        cardTitle.className = 'mobile-card-title';
        cardTitle.textContent = cells[1]?.textContent || `Item ${index + 1}`;
        
        cardHeader.appendChild(cardTitle);
        card.appendChild(cardHeader);
        
        const cardBody = document.createElement('div');
        cardBody.className = 'mobile-card-body';
        
        cells.forEach((cell, cellIndex) => {
            if (cellIndex === 0 || cellIndex === cells.length - 1) return; // Skip image and actions
            
            const field = document.createElement('div');
            field.className = 'mobile-field';
            
            const label = document.createElement('div');
            label.className = 'mobile-field-label';
            label.textContent = headers[cellIndex] || '';
            
            const value = document.createElement('div');
            value.className = 'mobile-field-value';
            value.innerHTML = cell.innerHTML;
            
            field.appendChild(label);
            field.appendChild(value);
            cardBody.appendChild(field);
        });
        
        // Adicionar ações se existirem
        const actionsCell = cells[cells.length - 1];
        if (actionsCell && actionsCell.querySelector('.action-buttons')) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'mobile-actions';
            actionsDiv.innerHTML = actionsCell.innerHTML;
            card.appendChild(actionsDiv);
        }
        
        card.appendChild(cardBody);
        mobileCards.appendChild(card);
    });
    
    tableContainer.appendChild(mobileCards);
    table.style.display = 'none';
}

// Mostrar tabela desktop
function showDesktopTable(tableContainer) {
    const table = tableContainer.querySelector('table');
    const mobileCards = tableContainer.querySelector('.mobile-cards');
    
    if (mobileCards) {
        mobileCards.style.display = 'none';
    }
    table.style.display = 'table';
}

// Configurar modais
function setupModals() {
    // Modal de produto
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const cancelProductBtn = document.getElementById('cancelProductBtn');

    productForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProduct();
    });

    cancelProductBtn?.addEventListener('click', () => closeModal('productModal'));

    // Fechar modais com clique fora ou X
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal.id);
        });
    });
}

// Configurar filtros
function setupFilters() {
    // Filtro de produtos
    const productSearch = document.getElementById('productSearch');
    const categoryFilter = document.getElementById('categoryFilter');

    productSearch?.addEventListener('input', filterProducts);
    categoryFilter?.addEventListener('change', filterProducts);

    // Filtro de pedidos
    const orderSearch = document.getElementById('orderSearch');
    const statusFilter = document.getElementById('statusFilter');
    const dateFilter = document.getElementById('dateFilter');

    orderSearch?.addEventListener('input', filterOrders);
    statusFilter?.addEventListener('change', filterOrders);
    dateFilter?.addEventListener('change', filterOrders);

    // Filtro de clientes
    const clientSearch = document.getElementById('clientSearch');
    clientSearch?.addEventListener('input', filterClients);
}

// Configurar formulários de configuração
function setupConfigForms() {
    // Formulário unificado de configurações
    const globalConfigForm = document.getElementById('globalConfigForm');
    if (globalConfigForm) {
        globalConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Mostrar loading no botão
            const submitBtn = globalConfigForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            submitBtn.disabled = true;
            
            try {
                // Coletar dados do formulário
                const formData = new FormData(globalConfigForm);
                const configData = {};
                
                // Converter FormData para objeto
                for (let [key, value] of formData.entries()) {
                    if (globalConfigForm.querySelector(`[name="${key}"]`).type === 'checkbox') {
                        configData[key] = globalConfigForm.querySelector(`[name="${key}"]`).checked;
                    } else {
                        configData[key] = value;
                    }
                }
                // Salvar no backend (nome, telefone, email, endereço)
                const token = localStorage.getItem('admin_token');
                const payload = {
                    name: configData.pizzariaName,
                    phone: configData.pizzariaPhone,
                    email: configData.pizzariaEmail,
                    address: configData.pizzariaAddress,
                };
                const resp = await fetch('/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) throw new Error('Falha ao salvar configurações');

                // Atualizar localStorage como cache (não mais fonte de verdade)
                localStorage.setItem('pizzariaConfig', JSON.stringify(configData));
                showNotification('Todas as configurações foram salvas com sucesso!', 'success');
            } catch (error) {
                showNotification('Erro ao salvar configurações. Tente novamente.', 'error');
            } finally {
                // Restaurar botão
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Botão de reset
    const resetBtn = document.getElementById('resetAllConfigBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const confirmed = await customConfirm(
                'Restaurar Configurações Padrão',
                'Tem certeza de que deseja restaurar todas as configurações para os valores padrão?',
                'Esta ação não pode ser desfeita.'
            );
            
            if (confirmed) {
                // Limpar localStorage
                localStorage.removeItem('pizzariaConfig');
                
                // Recarregar valores padrão
                loadConfigDefaults();
                
                showNotification('Configurações restauradas para os valores padrão!', 'success');
            }
        });
    }
    
    // Carregar configurações salvas ao iniciar
    loadSavedConfig();
}

// Carregar configurações salvas
async function loadSavedConfig() {
    // Primeiro tenta do backend, senão usa localStorage
    const token = localStorage.getItem('admin_token');
    try {
        const resp = await fetch('/api/admin/settings', {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (resp.ok) {
            const json = await resp.json();
            if (json?.sucesso) {
                const s = json.data || {};
                const map = {
                    pizzariaName: s.name,
                    pizzariaPhone: s.phone,
                    pizzariaEmail: s.email,
                    pizzariaAddress: s.address,
                };
                Object.keys(map).forEach(key => {
                    const field = document.querySelector(`[name="${key}"]`);
                    if (field && map[key] != null) field.value = map[key];
                });
            }
        }
    } catch (_) {}

    const savedConfig = localStorage.getItem('pizzariaConfig');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            
            // Aplicar valores salvos aos campos
            Object.keys(config).forEach(key => {
                const field = document.querySelector(`[name="${key}"]`);
                if (field) {
                    if (field.type === 'checkbox') {
                        field.checked = config[key];
                    } else {
                        field.value = config[key];
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }
}

// Carregar valores padrão
function loadConfigDefaults() {
    const defaults = {
        pizzariaName: 'Pizzaria Deliciosa',
        pizzariaPhone: '(11) 99999-9999',
        pizzariaEmail: 'contato@pizzaria.com',
        pizzariaAddress: 'Rua das Pizzas, 123 - São Paulo, SP',
        deliveryFee: '5.00',
        deliveryTime: '30',
        deliveryRadius: '15',
        acceptOnlineOrders: true,
        emailNotifications: true,
        soundNotifications: true
    };
    
    Object.keys(defaults).forEach(key => {
        const field = document.querySelector(`[name="${key}"]`);
        if (field) {
            if (field.type === 'checkbox') {
                field.checked = defaults[key];
            } else {
                field.value = defaults[key];
            }
        }
    });
}

// Mostrar seção
async function showSection(sectionName) {
    // Esconder todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar seção selecionada
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        // Mostrar loader imediatamente ao trocar de seção
        showLoaderOverlay();

        targetSection.classList.add('active');
        currentSection = sectionName;

        // Atualizar sidebar - adicionar classe active ao link correto
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const targetNavLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
        if (targetNavLink) {
            targetNavLink.classList.add('active');
        }
        
        // Atualizar título da página
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            const titles = {
                dashboard: 'Dashboard',
                produtos: 'Produtos',
                pedidos: 'Pedidos',
                relatorios: 'Relatórios',
                clientes: 'Clientes',
                avaliacoes: 'Avaliações',
                funcionamento: 'Funcionamento',
                entregas: 'Entregas',
                layout: 'Layout',
                configuracoes: 'Configurações'
            };
            pageTitle.textContent = titles[sectionName] || 'Admin Panel';
        }

        try {
            // Ajustes específicos por seção (aguardar dados do banco antes de esconder loader)
            if (sectionName === 'dashboard') {
                // Garantir gráficos e buscar dados do dashboard
                try { charts?.sales?.resize(); } catch(_) {}
                await refreshDashboardFromAPI();
                setTimeout(() => resizeCharts(), 50);
            } else if (sectionName === 'relatorios') {
                if (!charts.salesReport || !charts.products || !charts.peakHours) {
                    setupReportsCharts();
                }
                setTimeout(() => resizeCharts(), 50);
                await updateReportsCharts();
            } else if (sectionName === 'produtos') {
                await loadProductsFromAPI();
                setTimeout(() => resizeCharts(), 50);
            } else if (sectionName === 'pedidos') {
                await loadDataFromAPI(); // inclui pedidos e clientes
            } else if (sectionName === 'clientes') {
                await loadCustomersFromAPI();
            } else if (sectionName === 'layout') {
                await initLayoutSection();
            } else if (sectionName === 'funcionamento') {
                initFuncionamentoSection();
            } else if (sectionName === 'avaliacoes') {
                reviewsManager.renderReviews();
                reviewsManager.updateSummary();
            } else {
                // fallback: pequeno atraso para transição suave
                await new Promise(r => setTimeout(r, 100));
            }
        } finally {
            hideLoaderOverlay();
        }
    }
}

// Configurar gráficos - Melhorados para responsividade
function setupCharts() {
    // Configurações globais para todos os gráficos
    Chart.defaults.font.family = 'Inter, sans-serif';
    Chart.defaults.color = '#6c757d';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    
    // Gráfico de vendas do dashboard (inicial vazio; API preenche)
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        charts.sales = new Chart(salesCtx, {
            type: 'line',
            data: { labels: [], datasets: [{
                label: 'Receita (R$)',
                data: [],
                borderColor: '#fab427',
                backgroundColor: 'rgba(250, 180, 39, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: window.innerWidth <= 768 ? 2 : 4,
                pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                borderWidth: window.innerWidth <= 768 ? 2 : 3
            }]},
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#fab427',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => 'R$ ' + Number(ctx.parsed.y||0).toLocaleString('pt-BR')
                        }
                    }
                },
                scales: {
                    x: { 
                        display: true, 
                        grid: { display: false }, 
                        ticks: { 
                            autoSkip: true,
                            maxRotation: 0,
                            minRotation: 0,
                            padding: 6,
                            font: { size: window.innerWidth <= 768 ? 10 : 12 }
                        }
                    },
                    y: { display: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: window.innerWidth <= 768 ? 10 : 12 }, callback: (v)=> 'R$ ' + Number(v).toLocaleString('pt-BR') } }
                },
                elements: { point: { hoverBackgroundColor: '#fab427' } }
            }
        });
    }

    // Gráficos da seção de relatórios
    setupReportsCharts();
}

function setupReportsCharts() {
    const isMobile = window.innerWidth <= 768;
    
    // Gráfico de vendas por período
    const salesReportCtx = document.getElementById('salesReportChart');
    if (salesReportCtx) {
        charts.salesReport = new Chart(salesReportCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Vendas',
                    data: [],
                    backgroundColor: '#fab427',
                    borderRadius: isMobile ? 4 : 6,
                    borderSkipped: false,
                    maxBarThickness: isMobile ? 30 : 50,
                    categoryPercentage: 0.8,
                    barPercentage: 0.9
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart',
                    delay: (context) => {
                        return context.dataIndex * 100;
                    }
                },
                animations: {
                    y: {
                        from: 0,
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#fab427',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return 'R$ ' + context.parsed.y.toLocaleString('pt-BR');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            maxRotation: 0,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            callback: function(value) {
                                return 'R$ ' + (value / 1000) + 'k';
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico de produtos mais vendidos
    const productsCtx = document.getElementById('productsChart');
    if (productsCtx) {
        charts.products = new Chart(productsCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#fab427', '#28a745', '#17a2b8', '#6c757d'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    cutout: isMobile ? '60%' : '70%',
                    hoverBackgroundColor: ['#e0a225', '#218838', '#138496', '#545b62'],
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#ffffff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                animation: {
                    animateRotate: true,
                    animateScale: false,
                    duration: 800,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'right',
                        labels: {
                            font: {
                                size: isMobile ? 10 : 12,
                                family: 'Inter, sans-serif'
                            },
                            padding: isMobile ? 10 : 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            color: '#2c3e50',
                            boxWidth: 12,
                            boxHeight: 12
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(33, 37, 41, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#fab427',
                        borderWidth: 2,
                        cornerRadius: 12,
                        displayColors: true,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        caretSize: 6,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return [
                                    `Vendas: ${value}%`,
                                    `Total: ${percentage}% do mercado`
                                ];
                            },
                            labelColor: function(context) {
                                return {
                                    borderColor: context.dataset.backgroundColor[context.dataIndex],
                                    backgroundColor: context.dataset.backgroundColor[context.dataIndex]
                                };
                            }
                        },
                        filter: function(tooltipItem) {
                            return tooltipItem.parsed > 0;
                        }
                    }
                },
                onHover: (event, activeElements, chart) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                },
                onClick: (event, activeElements, chart) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const label = chart.data.labels[dataIndex];
                        console.log(`Produto selecionado: ${label}`);
                        // Aqui você pode adicionar ações ao clicar no produto
                    }
                }
            }
        });
    }

    // Gráfico de horários de pico
    const peakHoursCtx = document.getElementById('peakHoursChart');
    if (peakHoursCtx) {
        charts.peakHours = new Chart(peakHoursCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Pedidos',
                    data: [],
                    borderColor: '#17a2b8',
                    backgroundColor: 'rgba(23, 162, 184, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: isMobile ? 2 : 4,
                    pointHoverRadius: isMobile ? 4 : 6,
                    borderWidth: isMobile ? 2 : 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#17a2b8',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' pedidos';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            stepSize: 5
                        }
                    }
                }
            }
        });

        // Filtro de período do dashboard (7, 30, 3 meses)
        try {
            const filter = document.querySelector('#dashboard-section .chart-header .chart-filter');
            const titleEl = document.querySelector('#dashboard-section .chart-header h3');
            if (filter) {
                const mapTextToPeriod = (txt) => {
                    txt = String(txt || '').toLowerCase();
                    if (txt.includes('30')) return '30';
                    if (txt.includes('3') && txt.includes('mes')) return '90';
                    return '7';
                };
                const refresh = async () => {
                    const selected = filter.options[filter.selectedIndex]?.textContent || '7 dias';
                    const period = mapTextToPeriod(selected);
                    // Atualiza título do gráfico
                    if (titleEl) {
                        const map = { '7': 'Vendas dos Últimos 7 Dias', '30': 'Vendas dos Últimos 30 Dias', '90': 'Vendas dos Últimos 3 Meses' };
                        titleEl.textContent = map[period] || 'Vendas';
                    }
                    const token = localStorage.getItem('admin_token');
                    if (!token) return;
                    // Usar o sistema de horário baseado na API
                    const now = dateTimeSystem?.getCurrentTime?.() || new Date();
                    const tzOffsetMin = (typeof dateTimeSystem?.getTzOffsetMinutes === 'function') ? dateTimeSystem.getTzOffsetMinutes() : Math.round((dateTimeSystem?.offsetFromServer || 0) / 60000);
                    const qs = new URLSearchParams({ period: String(period), now: now.toISOString(), tzOffsetMinutes: String(tzOffsetMin) });
                    const resp = await fetch(`/api/admin/reports?${qs.toString()}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const json = await resp.json().catch(()=>null);
                    if (!resp.ok || !json?.sucesso) return;
                    const sales = json.data?.sales;
                    if (sales) {
                        updateSalesChart(sales);
                    }
                };
                filter.addEventListener('change', refresh);
                // Atualizar inicialmente com o período atualmente selecionado
                refresh();
            }
        } catch(_) {}
    }
}

async function updateReportsCharts() {
    const period = (document.querySelector('.period-btn.active')?.dataset.period || '7');
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    try {
        const now = dateTimeSystem?.getCurrentTime?.() || new Date();
        const tzOffsetMin = (typeof dateTimeSystem?.getTzOffsetMinutes === 'function') ? dateTimeSystem.getTzOffsetMinutes() : Math.round((dateTimeSystem?.offsetFromServer || 0) / 60000);
        const qs = new URLSearchParams({ period: String(period), now: now.toISOString(), tzOffsetMinutes: String(tzOffsetMin) });
        const resp = await fetch(`/api/admin/reports?${qs.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await resp.json();
        if (!resp.ok || !json?.sucesso) throw new Error(json?.mensagem || 'Falha ao carregar relatórios');

    const { sales, products, peakHours, metrics } = json.data || {};

        // Atualizar vendas por período (bar)
        if (charts.salesReport && sales) {
            // Recriar para animações consistentes em trocas de período
            charts.salesReport.destroy();
            const salesReportCtx = document.getElementById('salesReportChart');
            const isMobile = window.innerWidth <= 768;
            charts.salesReport = new Chart(salesReportCtx, {
                type: 'bar',
                data: { labels: sales.labels, datasets: [{
                    label: 'Vendas',
                    data: sales.data,
                    backgroundColor: '#fab427',
                    borderRadius: isMobile ? 4 : 6,
                    borderSkipped: false,
                    maxBarThickness: isMobile ? 30 : 50,
                    categoryPercentage: 0.8,
                    barPercentage: 0.9
                }]},
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 1000, easing: 'easeInOutQuart', delay: ctx => ctx.dataIndex * 100 },
                    animations: { y: { from: 0, duration: 1000, easing: 'easeInOutQuart' } },
                    layout: { padding: { left: 10, right: 10, top: 10, bottom: 10 } },
                    plugins: { legend: { display: false }, tooltip: {
                        backgroundColor: 'rgba(33, 37, 41, 0.9)', titleColor: '#fff', bodyColor: '#fff',
                        borderColor: '#fab427', borderWidth: 1, cornerRadius: 8, displayColors: false,
                        callbacks: { label: (c) => 'R$ ' + c.parsed.y.toLocaleString('pt-BR') }
                    }},
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: isMobile ? 10 : 12 }, maxRotation: 0, minRotation: 0 } },
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: isMobile ? 10 : 12 }, callback: v => 'R$ ' + (v/1000) + 'k' } }
                    }
                }
            });
        }

        // Produtos mais vendidos (doughnut)
        if (charts.products && products) {
            charts.products.data.labels = products.labels;
            charts.products.data.datasets[0].data = products.percentages;
            charts.products.update('active');
        }

        // Horários de pico (line)
        if (charts.peakHours && peakHours) {
            charts.peakHours.data.labels = peakHours.labels;
            charts.peakHours.data.datasets[0].data = peakHours.data;
            charts.peakHours.update('none');
        }

        // Métricas
        if (metrics) {
            const fmtBRL = (n) => (new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })).format(Number(n||0));
            const ticket = fmtBRL(metrics.ticket_medio || 0);
            const entrega = `${Math.max(0, Number(metrics.tempo_medio_entrega_min||0))} min`;
            const cancel = `${Math.max(0, Number(metrics.taxa_cancelamento||0)).toFixed(1)}%`;
            const rating = `${Number(metrics.avaliacao_media||0).toFixed(1)} `;
            const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerHTML = text + (id==='metricAvaliacao' ? '<i class="fas fa-star metric-star" aria-hidden="true"></i>' : ''); };
            setText('metricTicketMedio', ticket);
            setText('metricTempoEntrega', entrega);
            setText('metricCancelamento', cancel);
            setText('metricAvaliacao', rating);
        }
    } catch (e) {
        console.warn('Falha ao atualizar relatórios:', e.message);
    }
}

// Renderizar tabela de produtos
function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    products.forEach(product => {
        const imgSrc = product.img && typeof product.img === 'string' && product.img.trim() !== ''
            ? product.img
            : '/assets/images/default-images/pizza-desenho.png';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${imgSrc}" alt="${product.name}" class="product-img" onerror="this.onerror=null;this.src='/assets/images/default-images/pizza-desenho.png'">
            </td>
            <td>${product.name}</td>
            <td>${product.category === 'pizza' ? 'Pizza' : 'Bebida'}</td>
            <td>R$ ${product.price[product.price.length - 1].toFixed(2)}</td>
            <td>
                <span class="status-badge ${product.status}">
                    ${product.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Renderizar tabela de pedidos
function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    orders.forEach(order => {
        const row = document.createElement('tr');
        const statusTexts = {
            pendente: 'Pendente',
            preparando: 'Preparando',
            a_caminho: 'A caminho',
            entregue: 'Entregue',
            cancelado: 'Cancelado'
        };

        const addrText = String(order.endereco || '—');
        const addrHtml = addrText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const addrTitle = addrText.replace(/"/g, '&quot;');

        row.innerHTML = `
            <td><strong>#${order.id}</strong></td>
            <td>${order.cliente}</td>
            <td>${formatDateTime(order.data)}</td>
            <td>${order.items.length} item(s)</td>
            <td class="addr-cell"><span class="addr-ellipsis" title="${addrTitle}">${addrHtml}</span></td>
            <td>R$ ${order.total.toFixed(2)}</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${statusTexts[order.status] || '—'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="viewOrder('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    // Atualizar badge após render
    updateOrdersBadgeFromLocal();
}

// Renderizar pedidos em cards para modo fullscreen
function renderOrdersCards() {
    const ordersGrid = document.getElementById('ordersGrid');
    if (!ordersGrid) return;

    ordersGrid.innerHTML = '';

    const statusTexts = {
        pendente: 'Pendente',
        preparando: 'Preparando',
        a_caminho: 'A caminho',
        entregue: 'Entregue',
        cancelado: 'Cancelado'
    };

    orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        
        // Format date and time
        const orderDate = new Date(order.data);
        const dateStr = orderDate.toLocaleDateString('pt-BR');
        const timeStr = orderDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // Generate items HTML
        const itemsHTML = order.items.map(item => `
            <div class="item-row">
                <div class="item-details">
                    <div class="item-name">${item.nome}</div>
                    <div class="item-quantity">Qtd: ${item.quantidade}</div>
                </div>
                <div class="item-price">R$ ${item.preco.toFixed(2)}</div>
            </div>
        `).join('');

        // Get status info for dynamic button
        const statusInfo = STATUS_INFO[order.status];
        const canAdvance = STATUS_PROGRESSION[order.status] !== null;

        orderCard.innerHTML = `
            <div class="order-card-header">
                <div>
                    <div class="order-number">#${order.id}</div>
                    <div class="order-time">${dateStr} às ${timeStr}</div>
                </div>
                <div class="order-status-card ${order.status}">
                    <i class="${statusInfo.icon}"></i>
                    ${statusInfo.text}
                </div>
            </div>

            <div class="order-customer">
                <div class="customer-name">
                    <i class="fas fa-user"></i>
                    ${order.cliente}
                </div>
                <div class="customer-contact">
                    <div class="contact-item phone-contact" onclick="openWhatsApp('${order.telefone}')">
                        <i class="fab fa-whatsapp"></i>
                        ${order.telefone}
                    </div>
                    <div class="contact-item address-contact" onclick="openMaps('${order.endereco}')">
                        <i class="fas fa-map-marker-alt"></i>
                        ${order.endereco}
                    </div>
                </div>
            </div>

            <div class="order-items">
                <h4>
                    <i class="fas fa-pizza-slice"></i>
                    Items do Pedido
                </h4>
                <div class="items-list">
                    ${itemsHTML}
                </div>
            </div>

            <div class="order-total">
                <div class="total-row">
                    <span class="total-label">Total do Pedido</span>
                    <span class="total-value">R$ ${order.total.toFixed(2)}</span>
                </div>
            </div>

            <div class="order-actions">
                <button class="action-btn-card view" onclick="viewOrder('${order.id}')">
                    <i class="fas fa-eye"></i>
                    Ver Detalhes
                </button>
                ${canAdvance ? `
                <button class="action-btn-card edit" onclick="advanceOrderStatus('${order.id}')">
                    <i class="${STATUS_INFO[STATUS_PROGRESSION[order.status]]?.icon || 'fas fa-arrow-right'}"></i>
                    ${statusInfo.nextAction}
                </button>
                ` : `
                <button class="action-btn-card edit disabled">
                    <i class="${statusInfo.icon}"></i>
                    ${statusInfo.text}
                </button>
                `}
                ${(order.status === 'pendente' || order.status === 'preparando') ? `
                <button class="cancel-btn-icon" onclick="cancelOrder('${order.id}')" title="Cancelar pedido">
                    <i class="fas fa-times"></i>
                </button>
                ` : ''}
            </div>
        `;

        ordersGrid.appendChild(orderCard);
    });
    // Atualizar badge após render
    updateOrdersBadgeFromLocal();
}

// Renderizar tabela de clientes
function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const fmtBRL = (n) => (new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })).format(Number(n||0));

    clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.nome}</td>
            <td>${client.email}</td>
            <td>${client.telefone || '—'}</td>
            <td>${client.pedidos ?? 0}</td>
            <td>${fmtBRL(client.totalGasto ?? 0)}</td>
            <td>${client.ultimoPedido ? formatDate(client.ultimoPedido) : '—'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="viewClient(${client.id})" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Filtros
function filterProducts() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            product.description.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || product.category === category;
        
        return matchesSearch && matchesCategory;
    });

    renderFilteredProducts(filteredProducts);
}

function renderFilteredProducts(filteredProducts) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    filteredProducts.forEach(product => {
        const imgSrc = product.img && typeof product.img === 'string' && product.img.trim() !== ''
            ? product.img
            : '/assets/images/default-images/pizza-desenho.png';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${imgSrc}" alt="${product.name}" class="product-img" onerror="this.onerror=null;this.src='/assets/images/default-images/pizza-desenho.png'">
            </td>
            <td>${product.name}</td>
            <td>${product.category === 'pizza' ? 'Pizza' : 'Bebida'}</td>
            <td>R$ ${product.price[product.price.length - 1].toFixed(2)}</td>
            <td>
                <span class="status-badge ${product.status}">
                    ${product.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterOrders() {
    const searchTerm = document.getElementById('orderSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('statusFilter')?.value || '';
    const date = document.getElementById('dateFilter')?.value || '';

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.cliente.toLowerCase().includes(searchTerm) ||
                            order.id.includes(searchTerm);
        const matchesStatus = !status || order.status === status;
        const matchesDate = !date || order.data.includes(date);
        
        return matchesSearch && matchesStatus && matchesDate;
    });

    renderFilteredOrders(filteredOrders);
}

function renderFilteredOrders(filteredOrders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const statusTexts = {
        pendente: 'Pendente',
        preparando: 'Preparando',
        a_caminho: 'A caminho',
        entregue: 'Entregue',
        cancelado: 'Cancelado'
    };

    filteredOrders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>#${order.id}</strong></td>
            <td>${order.cliente}</td>
            <td>${formatDateTime(order.data)}</td>
            <td>${order.items.length} item(s)</td>
            <td>R$ ${order.total.toFixed(2)}</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${statusTexts[order.status]}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="viewOrder('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterClients() {
    const searchTerm = document.getElementById('clientSearch')?.value.toLowerCase() || '';

    const filteredClients = clients.filter(client => {
        return client.nome.toLowerCase().includes(searchTerm) ||
               client.email.toLowerCase().includes(searchTerm) ||
               client.telefone.includes(searchTerm);
    });

    renderFilteredClients(filteredClients);
}

function renderFilteredClients(filteredClients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const fmtBRL = (n) => (new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })).format(Number(n||0));

    filteredClients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.nome}</td>
            <td>${client.email}</td>
            <td>${client.telefone || '—'}</td>
            <td>${client.pedidos ?? 0}</td>
            <td>${fmtBRL(client.totalGasto ?? 0)}</td>
            <td>${client.ultimoPedido ? formatDate(client.ultimoPedido) : '—'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="viewClient(${client.id})" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Funções de produto
function openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('productModalTitle');
    const imgInput = document.getElementById('productImageInput');
    const imgEl = document.getElementById('productImagePreview');
    const previewBox = document.getElementById('productImagePreviewWrapper');
    const clearBtn = document.getElementById('clearProductImageBtn');
    // Reset preview state
    if (imgEl) {
        imgEl.src = '';
        imgEl.classList.remove('show');
        imgEl.style.display = 'none';
    }
    previewBox?.classList.remove('has-image');
    previewBox?.querySelector('.placeholder')?.classList.remove('hidden');
    form.dataset.imageData = '';

    if (productId) {
        const product = products.find(p => p.id === productId);
        title.textContent = 'Editar Produto';
        
        form.name.value = product.name;
        form.category.value = product.category;
        form.description.value = product.description;
        form.price1.value = product.price[0] || '';
        form.price2.value = product.price[1] || '';
        form.price3.value = product.price[2] || '';
        
        form.dataset.editId = productId;
        // Pre-fill preview with current product image if available
        if (imgEl && product?.img) {
            imgEl.src = product.img;
            imgEl.onload = () => imgEl.classList.add('show');
            imgEl.style.display = 'block';
            previewBox?.classList.add('has-image');
            previewBox?.querySelector('.placeholder')?.classList.add('hidden');
        }
    } else {
        title.textContent = 'Adicionar Produto';
        form.reset();
        delete form.dataset.editId;
    }

    modal.classList.add('show');

    // Bind change handler once per open to show preview
    if (imgInput) {
        imgInput.onchange = (e) => handleImageInput(e, { imgEl, previewBox, form });
    }

    // Bind preview interactions once
    if (previewBox && !previewBox.dataset.bound) {
        previewBox.addEventListener('click', () => imgInput?.click());
        previewBox.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                imgInput?.click();
            }
        });
        ['dragenter','dragover'].forEach(evt => {
            previewBox.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                previewBox.classList.add('drag-over');
            });
        });
        ['dragleave','dragend','drop'].forEach(evt => {
            previewBox.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                previewBox.classList.remove('drag-over');
            });
        });
        previewBox.addEventListener('drop', (e) => {
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                processSelectedFile(file, { imgEl, previewBox, form });
            }
        });
        previewBox.dataset.bound = '1';
    }

    // Clear button
    if (clearBtn) clearBtn.onclick = (e) => {
        e.stopPropagation();
        imgInput.value = '';
        imgEl.src = '';
        imgEl.classList.remove('show');
        imgEl.style.display = 'none';
        previewBox.classList.remove('has-image');
        previewBox.querySelector('.placeholder')?.classList.remove('hidden');
        form.dataset.imageData = '';
    };
}

// Validate and show image from input change
function handleImageInput(e, ctx) {
    const file = e.target.files && e.target.files[0];
    if (!file) {
        clearPreview(ctx);
        return;
    }
    processSelectedFile(file, ctx);
}

function processSelectedFile(file, { imgEl, previewBox, form }) {
    const validTypes = ['image/jpeg','image/png','image/webp','image/gif'];
    const maxSize = 3 * 1024 * 1024; // 3MB (alinhado com o backend)
    if (!validTypes.includes(file.type)) {
        showNotification('Formato inválido. Use JPG, PNG, WEBP ou GIF.', 'error');
        return;
    }
    if (file.size > maxSize) {
        showNotification('Imagem muito grande. Tamanho máximo: 3MB.', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        if (imgEl) {
            imgEl.src = ev.target.result;
            imgEl.style.display = 'block';
            requestAnimationFrame(() => imgEl.classList.add('show'));
        }
        previewBox?.classList.add('has-image');
        previewBox?.querySelector('.placeholder')?.classList.add('hidden');
        if (form) form.dataset.imageData = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function clearPreview({ imgEl, previewBox, form }) {
    if (imgEl) {
        imgEl.src = '';
        imgEl.classList.remove('show');
        imgEl.style.display = 'none';
    }
    previewBox?.classList.remove('has-image');
    previewBox?.querySelector('.placeholder')?.classList.remove('hidden');
    if (form) form.dataset.imageData = '';
}

async function saveProduct() {
    const form = document.getElementById('productForm');
    const formData = new FormData(form);
    
    const uploadedImage = form.dataset.imageData;
    const productData = {
        name: formData.get('name'),
        category: formData.get('category'),
        description: formData.get('description'),
        price: [
            parseFloat(formData.get('price1')) || 0,
            parseFloat(formData.get('price2')) || 0,
            parseFloat(formData.get('price3'))
        ],
        sizes: ['320g', '530g', '860g'],
        // Enviar base64 quando houver upload; caso contrário, enviar null para usar fallback no frontend
        img: uploadedImage || null,
        status: 'active'
    };

    try {
        const token = localStorage.getItem('admin_token');
        const isEdit = !!form.dataset.editId;
        const url = isEdit ? `/api/admin/products/${parseInt(form.dataset.editId)}` : '/api/admin/products';
        const method = isEdit ? 'PUT' : 'POST';
        const resp = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(productData)
        });
        const result = await resp.json();
        if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao salvar produto');
        await loadProductsFromAPI();
        closeModal('productModal');
        showNotification('Produto salvo com sucesso!', 'success');
    } catch (err) {
        console.error(err);
        showNotification(err.message || 'Erro ao salvar produto', 'error');
    }
}

function editProduct(id) {
    openProductModal(id);
}

async function deleteProduct(id) {
    const confirmed = await customConfirm(
        'Tem certeza que deseja excluir este produto?',
        'Excluir Produto',
        'Excluir',
        'Cancelar'
    );
    
    if (confirmed) {
        try {
            const token = localStorage.getItem('admin_token');
            const resp = await fetch(`/api/admin/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            const result = await resp.json();
            if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao excluir produto');
            await loadProductsFromAPI();
            showNotification('Produto excluído com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            showNotification(err.message || 'Erro ao excluir produto', 'error');
        }
    }
}

// Funções de pedido
async function viewOrder(orderId) {
    let order = orders.find(o => o.id === orderId);
    try {
        const token = localStorage.getItem('admin_token');
        const resp = await fetch(`/api/admin/orders/${orderId}`, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        const result = await resp.json();
        if (resp.ok && result.sucesso) {
            const d = result.data;
            order = {
                id: String(d.id),
                status: d.status,
                data: d.data,
                cliente: d.cliente,
                telefone: d.telefone,
                endereco: (d.formattedAddress && d.formattedAddress.trim()) || (function(a){
                    if (!a) return order?.endereco || '—';
                    const p1 = [];
                    if (a.endereco) p1.push(a.endereco);
                    if (a.numero) p1.push(', ' + a.numero);
                    if (a.bairro) p1.push(' - ' + a.bairro);
                    const l1 = p1.join('');
                    const p2 = [];
                    if (a.cidade) p2.push(a.cidade);
                    if (a.estado) p2.push(a.estado);
                    const l2 = p2.length ? p2.join('/') : '';
                    const cep = a.cep ? (l2 ? ', CEP: ' + a.cep : 'CEP: ' + a.cep) : '';
                    const comp = a.complemento ? ', ' + a.complemento : '';
                    const str = [l1, (l1 && l2) ? ' - ' : '', l2, cep, comp].join('');
                    return str || order?.endereco || '—';
                })(d.address),
                total: d.totals?.total ?? order?.total ?? 0,
                items: Array.isArray(d.items) ? d.items.map(it=>({ nome: it.nome, quantidade: it.quantidade, preco: Number(it.preco) })) : (order?.items||[])
            };
        }
    } catch(_) {}
    if (!order) return;

    const modal = document.getElementById('orderModal');
    const modalBody = document.getElementById('orderModalBody');

    modalBody.innerHTML = `
        <div class="order-details">
            <div class="order-header">
                <h4>Pedido #${order.id}</h4>
                <span class="status-badge ${order.status}">${getStatusText(order.status)}</span>
            </div>
            
            <div class="order-info">
                <div class="info-group">
                    <label>Cliente:</label>
                    <span>${order.cliente}</span>
                </div>
                <div class="info-group">
                    <label>Telefone:</label>
                    <span>${order.telefone}</span>
                </div>
                <div class="info-group">
                    <label>Data/Hora:</label>
                    <span>${formatDateTime(order.data)}</span>
                </div>
                <div class="info-group">
                    <label>Endereço:</label>
                    <span>${order.endereco}</span>
                </div>
            </div>
            
            <div class="order-items">
                <h5>Itens do Pedido:</h5>
                ${order.items.map(item => `
                    <div class="item-row">
                        <span>${item.nome}</span>
                        <span>Qty: ${item.quantidade}</span>
                        <span>R$ ${item.preco.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            
            <div class="order-total">
                <strong>Total: R$ ${order.total.toFixed(2)}</strong>
            </div>
            
            <div class="order-actions">
                <select id="newStatus">
                    <option value="pendente" ${order.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="preparando" ${order.status === 'preparando' ? 'selected' : ''}>Preparando</option>
                    <option value="a_caminho" ${order.status === 'a_caminho' ? 'selected' : ''}>A caminho</option>
                    <option value="entregue" ${order.status === 'entregue' ? 'selected' : ''}>Entregue</option>
                    <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
                <button class="btn-primary" onclick="updateOrderStatusFromModal('${orderId}')">
                    Atualizar Status
                </button>
            </div>
        </div>
    `;

    modal.classList.add('show');
}

async function updateOrderStatusFromModal(orderId) {
    const newStatus = document.getElementById('newStatus').value;
    try {
        const token = localStorage.getItem('admin_token');
        const resp = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ status: newStatus })
        });
        const result = await resp.json();
        if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao atualizar status');
        const order = orders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        renderOrdersTable();
        renderOrdersCards();
        closeModal('orderModal');
        showNotification('Status do pedido atualizado!', 'success');
        updateOrdersBadgeFromLocal();
    } catch (e) {
        showNotification(e.message || 'Erro ao atualizar status', 'error');
    }
}

// Sistema de progressão dinâmica de status
const STATUS_PROGRESSION = {
    pendente: 'preparando',
    preparando: 'a_caminho',
    a_caminho: 'entregue',
    entregue: null, // Status final
    cancelado: null  // Status final
};

const STATUS_INFO = {
    pendente: {
        text: 'Pendente',
        nextAction: 'Aceitar Pedido',
        icon: 'fas fa-clock',
        color: '#92400e'
    },
    preparando: {
        text: 'Preparando',
        nextAction: 'Enviar para Entrega',
        icon: 'fas fa-utensils',
        color: '#1e40af'
    },
    a_caminho: {
        text: 'A caminho',
        nextAction: 'Marcar como Entregue',
        icon: 'fas fa-truck',
        color: '#3730a3'
    },
    entregue: {
        text: 'Entregue',
        nextAction: null,
        icon: 'fas fa-check-circle',
        color: '#065f46'
    },
    cancelado: {
        text: 'Cancelado',
        nextAction: null,
        icon: 'fas fa-times-circle',
        color: '#991b1b'
    }
};

// Função para avançar status do pedido
async function advanceOrderStatus(orderId) {
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
        showNotification('Pedido não encontrado!', 'error');
        return;
    }

    const currentStatus = order.status;
    const nextStatus = STATUS_PROGRESSION[currentStatus];
    
    if (!nextStatus) {
        showNotification('Este pedido já está no status final!', 'info');
        return;
    }

    try {
        const token = localStorage.getItem('admin_token');
        const resp = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ status: nextStatus })
        });
        const result = await resp.json();
        if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao avançar status');
        order.status = nextStatus;
        renderOrdersTable();
        renderOrdersCards();
    updateOrdersBadgeFromLocal();
        const statusInfo = STATUS_INFO[nextStatus];
        showNotification(`Pedido #${orderId} atualizado para: ${statusInfo.text}`, 'success');
    } catch (e) {
        showNotification(e.message || 'Erro ao avançar status', 'error');
    }
}

// Atualiza status via API e sincroniza local
async function setOrderStatus(orderId, newStatus) {
    try {
        const token = localStorage.getItem('admin_token');
        const resp = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ status: newStatus })
        });
        const result = await resp.json();
        if (!resp.ok || !result.sucesso) throw new Error(result.mensagem || 'Falha ao atualizar status');
        const order = orders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        renderOrdersTable();
        renderOrdersCards();
        return true;
    } catch (e) {
        showNotification(e.message || 'Erro ao atualizar status', 'error');
        return false;
    }
}

// Função para aceitar pedido da notificação
function acceptOrder(orderId) {
    // Permitir aceitar mesmo que o pedido ainda não esteja carregado localmente
    setOrderStatus(orderId, 'preparando').then(ok => {
        if (ok) {
            showNotification(`Pedido #${orderId} aceito e movido para preparação!`, 'success');
            // Sincronizar lista de pedidos para garantir que apareça imediatamente
            try { loadDataFromAPI(); } catch (_) {}
        }
    });
}

// Função para cancelar pedido
function cancelOrder(orderId) {
    customConfirm(
        `Tem certeza que deseja cancelar o pedido #${orderId}? Esta ação não pode ser desfeita.`,
        'Cancelar Pedido',
        'Sim, Cancelar',
        'Não, Manter'
    ).then(confirmed => {
        if (confirmed) {
            const order = orders.find(o => o.id === orderId);
            
            if (!order) {
                showNotification('Pedido não encontrado!', 'error');
                return;
            }

            setOrderStatus(orderId, 'cancelado');
        }
    }).catch(() => {
        // User cancelled the action
    });
}

// Funções de cliente


function viewClient(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;

    const modal = document.getElementById('clientModal');
    const body = document.getElementById('clientModalBody');

    const addr = client.endereco || {};
    const fullAddress = [addr.rua, addr.numero && `, ${addr.numero}`, addr.bairro && ` - ${addr.bairro}`, '<br>', addr.cidade, addr.estado && ` - ${addr.estado}`, addr.cep && `, CEP: ${addr.cep}`, addr.complemento ? `, ${addr.complemento}` : '']
        .filter(Boolean)
        .join('');

    body.innerHTML = `
        <div class="client-details">
            <div class="cd-header">
                <div>
                    <h4>${client.nome}</h4>
                    <div class="cd-sub">Cliente desde ${client.ultimoPedido ? formatDate(client.ultimoPedido) : '—'}</div>
                </div>
                <span class="status-badge active">${client.pedidos} pedidos</span>
            </div>
            <div class="cd-grid">
                <div class="cd-card">
                    <h5>Contato</h5>
                    <div class="cd-row"><label>Email:</label><span>${client.email}</span></div>
                    <div class="cd-row"><label>Telefone:</label><span>${client.telefone || '—'}</span></div>
                </div>
                <div class="cd-card">
                    <h5>Endereço</h5>
                    <div class="cd-row"><span>${fullAddress}</span></div>
                </div>
                <div class="cd-card">
                    <h5>Resumo</h5>
                    <div class="cd-row"><label>Total gasto:</label><span>R$ ${(client.totalGasto ?? 0).toFixed(2)}</span></div>
                    <div class="cd-row"><label>Último pedido:</label><span>${client.ultimoPedido ? formatDate(client.ultimoPedido) : '—'}</span></div>
                </div>
                <div class="cd-card">
                    <h5>Preferências</h5>
                    <div class="cd-row"><span>${(client.preferenciaSabores||[]).join(', ') || '—'}</span></div>
                </div>
                
            </div>
        </div>
    `;

    modal.classList.add('show');
}

function editClient(id) {
    // Redireciona para visualização de cliente (para compatibilidade)
    viewClient(id);
}

async function deleteClient(id) {
    const confirmed = await customConfirm(
        'Tem certeza que deseja excluir este cliente?',
        'Excluir Cliente',
        'Excluir',
        'Cancelar'
    );
    
    if (confirmed) {
        clients = clients.filter(c => c.id !== id);
        renderClientsTable();
        showNotification('Cliente excluído com sucesso!', 'success');
    }
}

// Funções utilitárias
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function getStatusText(status) {
    return STATUS_INFO[status]?.text || status;
}

function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Estilos inline para a notificação
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;
    
    // Cores baseadas no tipo
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Adicionar ao DOM
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Adicionar CSS para animações das notificações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .order-details {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    
    .order-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #dee2e6;
        padding-bottom: 1rem;
    }
    
    .order-info {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }
    
    .info-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .info-group label {
        font-weight: 600;
        color: #6c757d;
        font-size: 0.9rem;
    }
    
    .order-items h5 {
        margin-bottom: 0.75rem;
        color: #212529;
    }
    
    .item-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f8f9fa;
    }
    
    .order-total {
        text-align: right;
        font-size: 1.1rem;
        padding: 1rem 0;
    }
    
    .order-actions {
        display: flex;
        gap: 1rem;
        align-items: center;
        justify-content: flex-end;
    }
    
    .order-actions select {
        padding: 0.5rem;
        border: 1px solid #dee2e6;
        border-radius: 4px;
    }
`;
document.head.appendChild(style);

// Função para exportar dados (exemplo)
function exportData(type) {
    let data, filename;
    
    switch(type) {
        case 'orders':
            data = orders;
            filename = 'pedidos.json';
            break;
        case 'products':
            data = products;
            filename = 'produtos.json';
            break;
        case 'clients':
            data = clients;
            filename = 'clientes.json';
            break;
        default:
            return;
    }
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename;
    link.click();
    
    showNotification('Dados exportados com sucesso!', 'success');
}

// Event listener para exportação
document.getElementById('exportOrdersBtn')?.addEventListener('click', () => exportData('orders'));

// Layout Management Functions
const layoutManager = {
    // State management
    eventsBound: false,
    currentLayout: {
        background: '../../assets/images/default-images/background.jpg',
        logo: '../../assets/images/default-images/logo_pizza.png',
        title: 'Pizzas 10% OFF',
        subtitle: 'Confira no cardápio',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, vitae beatae sint magnam, libero harum quae nobis veritatis iure hic provident illo porro.',
        carouselSlides: [
            { image: '../../assets/images/default-images/banner1.jpg', caption: 'Clássicas irresistíveis' },
            { image: '../../assets/images/default-images/banner2.jpg', caption: 'Promoções da semana' }
        ]
    },

    async init() {
        this.setupEventListeners();
        // Primeiro tentar carregar do backend; se falhar, usa cache local
        try {
            await this.loadFromServer();
        } catch(_) {
            this.loadStoredLayout();
        }
        this.updatePreviews();
    },

    getToken() { return localStorage.getItem('admin_token'); },

    async apiFetch(path, options = {}) {
        const headers = options.headers || {};
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        const res = await fetch(path, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.sucesso === false) {
            throw new Error(data.mensagem || `Falha na requisição: ${path}`);
        }
        return data;
    },

    async loadFromServer() {
        const data = await this.apiFetch('/api/admin/layout');
        const set = data.data || {};
        // Mapear config para o estado local do editor
        this.currentLayout.background = set.home_background_url || this.currentLayout.background;
        this.currentLayout.logo = set.logo_url || this.currentLayout.logo;
        this.currentLayout.title = set.home_title || this.currentLayout.title;
        this.currentLayout.subtitle = set.home_subtitle || this.currentLayout.subtitle;
        this.currentLayout.description = set.home_description || this.currentLayout.description;
        this.currentLayout.carouselSlides = Array.isArray(set.carousel) && set.carousel.length
            ? set.carousel.map(s => ({ image: s.image_url, caption: s.caption }))
            : this.currentLayout.carouselSlides;
        // cache local
        this.saveLayoutSilent();
    },

    setupEventListeners() {
        if (this.eventsBound) return; // evita múltiplos binds que causam duplicação
        // Background image upload
        const backgroundInput = document.getElementById('backgroundInput');
        if (backgroundInput) {
            backgroundInput.addEventListener('change', (e) => this.handleBackgroundUpload(e));
        }

        // Logo upload
        const logoInput = document.getElementById('logoInput');
        if (logoInput) {
            logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        }

        // Text inputs
        const titleInput = document.getElementById('titleText');
        const subtitleInput = document.getElementById('subtitleText');
        const descriptionInput = document.getElementById('descriptionText');

        if (titleInput) {
            titleInput.addEventListener('input', (e) => this.updateTextPreview('title', e.target.value));
        }
        if (subtitleInput) {
            subtitleInput.addEventListener('input', (e) => this.updateTextPreview('subtitle', e.target.value));
        }
        if (descriptionInput) {
            descriptionInput.addEventListener('input', (e) => this.updateTextPreview('description', e.target.value));
        }

        // Carousel image upload
        const carouselInput = document.getElementById('carouselInput');
        if (carouselInput) {
            carouselInput.addEventListener('change', (e) => this.handleCarouselUpload(e));
        }

        // Carousel slide clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.carousel-slide-preview')) {
                const slide = e.target.closest('.carousel-slide-preview');
                this.selectSlide(slide);
            }
        });

        this.eventsBound = true; // marca como ligado uma vez
    },

    loadStoredLayout() {
        const stored = localStorage.getItem('pizzaria_layout');
        if (stored) {
            try {
                this.currentLayout = { ...this.currentLayout, ...JSON.parse(stored) };
            } catch (e) {
                console.warn('Failed to load stored layout:', e);
            }
        }
    },

    saveLayout() {
        localStorage.setItem('pizzaria_layout', JSON.stringify(this.currentLayout));
        showNotification('Layout salvo com sucesso!', 'success');
    },

    saveLayoutSilent() {
        localStorage.setItem('pizzaria_layout', JSON.stringify(this.currentLayout));
    },

    updatePreviews() {
        this.updateBackgroundPreview();
        this.updateLogoPreview();
        this.updateTextInputs();
        this.updateTextPreview();
        this.updateCarouselPreview();
    },

    // Background functions
    async handleBackgroundUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!this.validateImageFile(file)) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                // Enviar para o backend como base64
                const resp = await this.apiFetch('/api/admin/layout/background', {
                    method: 'PUT',
                    body: JSON.stringify({ image: e.target.result })
                });
                const bg = resp.data?.home_background_url || e.target.result;
                this.currentLayout.background = bg;
                this.updateBackgroundPreview();
                this.saveLayout();
                showNotification('Background atualizado!', 'success');
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Erro ao atualizar background', 'error');
            }
        };
        reader.readAsDataURL(file);
    },

    updateBackgroundPreview() {
        const bgImg = document.getElementById('backgroundImg');
        if (bgImg) {
            bgImg.src = this.currentLayout.background;
        }
    },

    async resetBackground() {
        try {
            const url = '../../assets/images/default-images/background.jpg';
            const resp = await this.apiFetch('/api/admin/layout/background', {
                method: 'PUT',
                body: JSON.stringify({ image: url })
            });
            this.currentLayout.background = resp.data?.home_background_url || url;
            this.updateBackgroundPreview();
            this.saveLayoutSilent();
            showNotification('Background restaurado!', 'info');
        } catch (e) {
            showNotification('Falha ao restaurar background', 'error');
        }
    },

    // Logo functions
    async handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!this.validateImageFile(file)) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const resp = await this.apiFetch('/api/admin/layout/logo', {
                    method: 'PUT',
                    body: JSON.stringify({ image: e.target.result })
                });
                const logo = resp.data?.logo_url || e.target.result;
                this.currentLayout.logo = logo;
                this.updateLogoPreview();
                this.saveLayout();
                showNotification('Logo atualizada!', 'success');
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Erro ao atualizar logo', 'error');
            }
        };
        reader.readAsDataURL(file);
    },

    updateLogoPreview() {
        const logoImg = document.getElementById('logoImg');
        if (logoImg) {
            logoImg.src = this.currentLayout.logo;
        }
    },

    async resetLogo() {
        try {
            const url = '../../assets/images/default-images/logo_pizza.png';
            const resp = await this.apiFetch('/api/admin/layout/logo', {
                method: 'PUT',
                body: JSON.stringify({ image: url })
            });
            this.currentLayout.logo = resp.data?.logo_url || url;
            this.updateLogoPreview();
            this.saveLayoutSilent();
            showNotification('Logo restaurada!', 'info');
        } catch (e) {
            showNotification('Falha ao restaurar logo', 'error');
        }
    },

    // Text functions
    updateTextInputs() {
        const titleInput = document.getElementById('titleText');
        const subtitleInput = document.getElementById('subtitleText');
        const descriptionInput = document.getElementById('descriptionText');

        if (titleInput) titleInput.value = this.currentLayout.title;
        if (subtitleInput) subtitleInput.value = this.currentLayout.subtitle;
        if (descriptionInput) descriptionInput.value = this.currentLayout.description;
    },

    updateTextPreview(type, value) {
        if (type) {
            this.currentLayout[type] = value;
        }

        const previewTitle = document.getElementById('previewTitle');
        const previewSubtitle = document.getElementById('previewSubtitle');
        const previewDescription = document.getElementById('previewDescription');

        if (previewTitle) previewTitle.textContent = this.currentLayout.title;
        if (previewSubtitle) previewSubtitle.textContent = this.currentLayout.subtitle;
        if (previewDescription) previewDescription.textContent = this.currentLayout.description;
    },

    async saveTexts() {
        try {
            await this.apiFetch('/api/admin/layout/texts', {
                method: 'PUT',
                body: JSON.stringify({
                    title: this.currentLayout.title,
                    subtitle: this.currentLayout.subtitle,
                    description: this.currentLayout.description
                })
            });
            this.saveLayout();
            showNotification('Textos salvos com sucesso!', 'success');
        } catch (e) {
            showNotification(e.message || 'Falha ao salvar textos', 'error');
        }
    },

    resetTexts() {
        this.currentLayout.title = 'Pizzas 10% OFF';
        this.currentLayout.subtitle = 'Confira no cardápio';
        this.currentLayout.description = 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, vitae beatae sint magnam, libero harum quae nobis veritatis iure hic provident illo porro.';
        
        this.updateTextInputs();
        this.updateTextPreview();
        this.saveLayoutSilent();
        showNotification('Textos restaurados!', 'info');
    },

    // Carousel functions
    handleCarouselUpload(event) {
        const inputEl = event.target;
        const files = Array.from(inputEl.files || []);
        if (!files.length) return;

        files.forEach(file => {
            if (!this.validateImageFile(file)) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentLayout.carouselSlides.push({
                    image: e.target.result,
                    caption: 'Nova imagem'
                });
                this.updateCarouselPreview();
                this.saveLayout();
            };
            reader.readAsDataURL(file);
        });

        // limpa valor do input para não re-disparar com os mesmos arquivos
        inputEl.value = '';
        showNotification(`${files.length} imagem(ns) adicionada(s) ao carousel!`, 'success');
    },

    updateCarouselPreview() {
        const carouselPreview = document.getElementById('carouselPreview');
        if (!carouselPreview) return;

        carouselPreview.innerHTML = '';

        this.currentLayout.carouselSlides.forEach((slide, index) => {
            const slideElement = document.createElement('div');
            slideElement.className = `carousel-slide-preview ${index === 0 ? 'active' : ''}`;
            slideElement.dataset.index = index;
            
            slideElement.innerHTML = `
                <img src="${slide.image}" alt="Slide ${index + 1}">
                <div class="slide-caption">${slide.caption}</div>
                <button class="remove-slide" onclick="layoutManager.removeSlide(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;

            carouselPreview.appendChild(slideElement);
        });
    },

    selectSlide(slideElement) {
        // Remove active class from all slides
        document.querySelectorAll('.carousel-slide-preview').forEach(s => s.classList.remove('active'));
        
        // Add active class to selected slide
        slideElement.classList.add('active');
        
        const index = parseInt(slideElement.dataset.index);
        const slide = this.currentLayout.carouselSlides[index];
        
        if (slide) {
            this.showSlideEditor(index, slide);
        }
    },

    showSlideEditor(index, slide) {
        const editor = document.getElementById('slideEditor');
        const captionInput = document.getElementById('slideCaption');
        
        if (editor && captionInput) {
            captionInput.value = slide.caption;
            editor.style.display = 'block';
            editor.dataset.editingIndex = index;
        }
    },

    updateSlide() {
        const editor = document.getElementById('slideEditor');
        const captionInput = document.getElementById('slideCaption');
        const index = parseInt(editor.dataset.editingIndex);
        
        if (this.currentLayout.carouselSlides[index]) {
            this.currentLayout.carouselSlides[index].caption = captionInput.value;
            this.updateCarouselPreview();
            this.cancelSlideEdit();
            this.saveLayout();
            showNotification('Slide atualizado!', 'success');
        }
    },

    cancelSlideEdit() {
        const editor = document.getElementById('slideEditor');
        if (editor) {
            editor.style.display = 'none';
            delete editor.dataset.editingIndex;
        }
    },

    async removeSlide(index) {
        if (this.currentLayout.carouselSlides.length <= 1) {
            showNotification('Deve haver pelo menos uma imagem no carousel!', 'error');
            return;
        }

        const confirmed = await customConfirm(
            'Tem certeza que deseja remover esta imagem?',
            'Remover Imagem',
            'Remover',
            'Cancelar'
        );
        
        if (confirmed) {
            this.currentLayout.carouselSlides.splice(index, 1);
            this.updateCarouselPreview();
            this.saveLayout();
            showNotification('Imagem removida do carousel!', 'info');
        }
    },

    async saveCarousel() {
        try {
            // Enviar slides para o backend (aceita base64 ou URLs)
            const slides = this.currentLayout.carouselSlides.map(s => ({ image: s.image, caption: s.caption }));
            const resp = await this.apiFetch('/api/admin/layout/carousel', {
                method: 'PUT',
                body: JSON.stringify({ slides })
            });
            const updated = (resp.data?.carousel || []).map(s => ({ image: s.image_url, caption: s.caption }));
            if (updated.length) this.currentLayout.carouselSlides = updated;
            this.updateCarouselPreview();
            this.saveLayout();
            showNotification('Carousel salvo com sucesso!', 'success');
        } catch (e) {
            showNotification(e.message || 'Falha ao salvar carousel', 'error');
        }
    },

    async resetCarousel() {
        const confirmed = await customConfirm(
            'Tem certeza que deseja restaurar o carousel para as imagens padrão?',
            'Restaurar Carousel',
            'Restaurar',
            'Cancelar'
        );
        
        if (confirmed) {
            this.currentLayout.carouselSlides = [
                { image: '../../assets/images/default-images/banner1.jpg', caption: 'Clássicas irresistíveis' },
                { image: '../../assets/images/default-images/banner2.jpg', caption: 'Promoções da semana' }
            ];
            await this.saveCarousel();
            showNotification('Carousel restaurado!', 'info');
        }
    },

    // Utility functions
    validateImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!validTypes.includes(file.type)) {
            showNotification('Tipo de arquivo inválido! Use JPG, PNG, GIF ou WEBP.', 'error');
            return false;
        }

        if (file.size > maxSize) {
            showNotification('Arquivo muito grande! Máximo 5MB.', 'error');
            return false;
        }

        return true;
    }
};

// Global functions for HTML onclick events
window.resetBackground = () => layoutManager.resetBackground();
window.resetLogo = () => layoutManager.resetLogo();
window.saveTexts = () => layoutManager.saveTexts();
window.resetTexts = () => layoutManager.resetTexts();
window.saveCarousel = () => layoutManager.saveCarousel();
window.resetCarousel = () => layoutManager.resetCarousel();
window.updateSlide = () => layoutManager.updateSlide();
window.cancelSlideEdit = () => layoutManager.cancelSlideEdit();
window.removeSlide = (index) => layoutManager.removeSlide(index);

// Initialize layout manager when layout section is accessed
async function initLayoutSection() {
    if (document.getElementById('layout-section')) {
        await layoutManager.init();
        await instagramManager.init();
    }
}

// Funcionamento (Status) Management
const statusManager = {
    state: {
        closedNow: false, // false = loja aberta (switch não checked), true = loja fechada (switch checked)
        reason: '',
        reopenAt: '', // ISO string
        notifyWhatsApp: false,
        notifyEmail: false,
        isManualMode: false, // false = automático (baseado nos horários), true = manual (controlado pelo switch)
        schedules: [] // [{ start: ISO, end: ISO, reason }]
    },

    async init() {
        // Mostrar estado de carregamento primeiro
        this.showLoadingState();
        
        await this.load();
        this.bindUI();
        this.render();
        console.log('StatusManager iniciado com dados do banco:', this.state);
    },

    showLoadingState() {
        const pill = document.getElementById('statusPill');
        if (pill) {
            pill.classList.add('loading');
            pill.classList.remove('open', 'closed');
            pill.innerHTML = '<i class="fas fa-circle"></i> Carregando...';
        }
    },

    bindUI() {
        const closeNowToggle = document.getElementById('closeNowToggle');
        const closeReason = document.getElementById('closeReason');
        const reopenAt = document.getElementById('reopenAt');
        const notifyWhatsApp = document.getElementById('notifyWhatsApp');
        const notifyEmail = document.getElementById('notifyEmail');
        const saveBtn = document.getElementById('saveStatusBtn');
        const clearBtn = document.getElementById('clearStatusBtn');
        const saveHoursBtn = document.getElementById('saveHoursBtn');
        const resetHoursBtn = document.getElementById('resetHoursBtn');
        const hoursGrid = document.getElementById('hoursGrid');

        closeNowToggle?.addEventListener('change', async () => {
            // Nova lógica: Switch controla modo de funcionamento
            // Checked (vermelho) = Modo Manual, Unchecked (azul) = Modo Automático
            const wasManualMode = this.state.isManualMode;
            this.state.isManualMode = closeNowToggle.checked;
            
            console.log('Switch alterado:', { 
                checked: closeNowToggle.checked, 
                newMode: this.state.isManualMode ? 'manual' : 'automático'
            });
            
            // Se mudou para modo automático, verificar horários de funcionamento
            if (!this.state.isManualMode) {
                this.state.closedNow = this.isClosedBySchedule();
            } else {
                // Se entrou em modo manual, manter o estado anterior ou definir como fechado
                if (!wasManualMode) {
                    // Primeira vez em modo manual, deixar fechado por padrão
                    this.state.closedNow = true;
                }
            }
            
            const success = await this.save();
            if (success) {
                this.render();
                this.updateSidebarPill();
                this.updateSwitchLabels();
                
                const mode = this.state.isManualMode ? 'manual' : 'automático';
                showNotification(`Modo ${mode} ativado!`, 'info');
            } else {
                // Reverter switch em caso de erro
                closeNowToggle.checked = !closeNowToggle.checked;
                this.state.isManualMode = wasManualMode;
                showNotification('Erro ao alterar modo de funcionamento', 'error');
            }
        });
        
        saveBtn?.addEventListener('click', async () => {
            // Só permite salvar se estivermos em modo manual
            if (!this.state.isManualMode) {
                showNotification('Para alterar o status, mude para modo manual primeiro', 'warning');
                return;
            }

            this.state.closedNow = true; // Ao salvar, estamos fechando manualmente
            this.state.reason = closeReason?.value?.trim() || '';
            this.state.reopenAt = reopenAt?.value ? new Date(reopenAt.value).toISOString() : '';
            this.state.notifyWhatsApp = notifyWhatsApp?.checked || false;
            this.state.notifyEmail = notifyEmail?.checked || false;
            
            const success = await this.save();
            if (success) {
                this.render();
                this.updateSidebarPill();
                
                // Mostrar notificação com informações sobre as notificações
                let message = 'Loja fechada manualmente!';
                if (this.state.notifyWhatsApp || this.state.notifyEmail) {
                    const notifications = [];
                    if (this.state.notifyWhatsApp) notifications.push('WhatsApp');
                    if (this.state.notifyEmail) notifications.push('Email');
                    message += ` Notificações enviadas via: ${notifications.join(' e ')}.`;
                }
                showNotification(message, 'success');
            } else {
                showNotification('Erro ao salvar status', 'error');
            }
        });
        clearBtn?.addEventListener('click', async () => {
            // Só permite limpar se estivermos em modo manual
            if (!this.state.isManualMode) {
                showNotification('Para alterar o status, mude para modo manual primeiro', 'warning');
                return;
            }

            this.state.closedNow = false; // Ao limpar, estamos reabrindo manualmente
            this.state.reason = '';
            this.state.reopenAt = '';
            this.state.notifyWhatsApp = false;
            this.state.notifyEmail = false;
            
            const success = await this.save();
            if (success) {
                this.render();
                this.updateSidebarPill();
                showNotification('Loja reaberta manualmente!', 'info');
            } else {
                showNotification('Erro ao limpar status', 'error');
            }
        });

        // Hours save/reset
        saveHoursBtn?.addEventListener('click', async () => {
            this.collectHoursFromUI();
            const success = await this.saveHours();
            if (success) {
                showNotification('Horários de funcionamento salvos!', 'success');
            } else {
                showNotification('Erro ao salvar horários', 'error');
            }
        });
        resetHoursBtn?.addEventListener('click', async () => {
            const confirmed = await customConfirm(
                'Restaurar horários padrão?',
                'Restaurar Horários',
                'Restaurar',
                'Cancelar'
            );
            
            if (confirmed) {
                const success = await this.resetHours();
                if (success) {
                    await this.load(); // Recarregar do banco
                    this.renderHours();
                    showNotification('Horários restaurados!', 'info');
                } else {
                    showNotification('Erro ao restaurar horários', 'error');
                }
            }
        });

        // Atualizar cor da linha ao alternar Atender
        hoursGrid?.addEventListener('change', (e) => {
            const target = e.target;
            if (target && target.matches('input[type="checkbox"][data-kind="enabled"]')) {
                const row = target.closest('.hours-row');
                if (!row) return;
                if (target.checked) {
                    row.classList.add('open');
                    row.classList.remove('closed');
                } else {
                    row.classList.add('closed');
                    row.classList.remove('open');
                }
            }
        });
    },

    // Business hours helpers
    daysOrder: [0,1,2,3,4,5,6],
    dayNames: ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'],
    getDefaultHours() {
        return {
            0: { enabled: true, open: '18:00', close: '23:00' },
            1: { enabled: true, open: '18:00', close: '23:00' },
            2: { enabled: true, open: '18:00', close: '23:00' },
            3: { enabled: true, open: '18:00', close: '23:00' },
            4: { enabled: true, open: '18:00', close: '23:59' },
            5: { enabled: true, open: '18:00', close: '23:59' },
            6: { enabled: true, open: '18:00', close: '23:00' },
        };
    },

    render() {
        // Inputs
        const closeNowToggle = document.getElementById('closeNowToggle');
        const closeReason = document.getElementById('closeReason');
        const reopenAt = document.getElementById('reopenAt');
        const notifyWhatsApp = document.getElementById('notifyWhatsApp');
        const notifyEmail = document.getElementById('notifyEmail');
        
        // Switch agora controla modo: checked = manual (vermelho), unchecked = automático (azul)
        if (closeNowToggle) {
            closeNowToggle.checked = !!this.state.isManualMode;
            console.log('Render: isManualMode =', this.state.isManualMode, 'switch checked =', closeNowToggle.checked);
        }
        if (closeReason) closeReason.value = this.state.reason || '';
        if (reopenAt) reopenAt.value = this.state.reopenAt ? this.toLocalDatetime(this.state.reopenAt) : '';
        if (notifyWhatsApp) notifyWhatsApp.checked = !!this.state.notifyWhatsApp;
        if (notifyEmail) notifyEmail.checked = !!this.state.notifyEmail;
        
        this.renderPill();
        this.updateSwitchLabels();
        this.toggleManualControls();
        this.renderHours();
    },

    renderPill() {
        const pill = document.getElementById('statusPill');
        if (!pill) {
            console.log('StatusPill não encontrado!');
            return;
        }
        
        // StatusPill agora mostra modo de operação (Automático/Manual)
        console.log('Renderizando pill:', { 
            isManualMode: this.state.isManualMode,
            pillElement: pill
        });
        
        // Remover estados anteriores e aplicar o novo estado
        pill.classList.remove('loading', 'automatic', 'manual');
        pill.classList.add(this.state.isManualMode ? 'manual' : 'automatic');
        pill.innerHTML = this.state.isManualMode
            ? '<i class="fas fa-circle"></i> Manual'
            : '<i class="fas fa-circle"></i> Automático';
    },

    updateSwitchLabels() {
        const switchLabel = document.getElementById('switchLabel');
        const switchDescription = document.getElementById('switchDescription');
        
        if (switchLabel && switchDescription) {
            if (this.state.isManualMode) {
                switchLabel.textContent = 'Modo Manual';
                switchDescription.textContent = 'Controle direto da abertura/fechamento da loja';
            } else {
                switchLabel.textContent = 'Modo Automático';
                switchDescription.textContent = 'Status baseado nos horários de funcionamento';
            }
        }
    },

    toggleManualControls() {
        // Elementos de controle manual
        const closeReason = document.getElementById('closeReason');
        const reopenAt = document.getElementById('reopenAt');
        const notifyWhatsApp = document.getElementById('notifyWhatsApp');
        const notifyEmail = document.getElementById('notifyEmail');
        const saveBtn = document.getElementById('saveStatusBtn');
        const clearBtn = document.getElementById('clearStatusBtn');
        
        const isManual = this.state.isManualMode;
        
        // Desabilitar/habilitar controles baseado no modo
        [closeReason, reopenAt, notifyWhatsApp, notifyEmail, saveBtn, clearBtn].forEach(element => {
            if (element) {
                element.disabled = !isManual;
                // Adicionar classe visual para controles desabilitados
                if (isManual) {
                    element.classList.remove('disabled-control');
                } else {
                    element.classList.add('disabled-control');
                }
            }
        });
    },

    updateSidebarPill() {
        const sidebarPill = document.getElementById('sidebarStatusPill');
        if (!sidebarPill) {
            console.log('SidebarStatusPill não encontrado!');
            return;
        }
        
        // SidebarPill mostra o status real da loja baseado na lógica de negócio
        let effectiveClosed;
        
        if (this.state.isManualMode) {
            // Modo manual: usar o valor do switch diretamente
            effectiveClosed = this.state.closedNow;
        } else {
            // Modo automático: verificar horários de funcionamento
            effectiveClosed = this.isClosedBySchedule();
        }
        
        console.log('Atualizando sidebar pill:', { 
            isManualMode: this.state.isManualMode,
            closedNow: this.state.closedNow,
            effectiveClosed 
        });
        
        // Remover estado de loading e aplicar o estado real
        sidebarPill.classList.remove('loading', 'closed', 'open');
        sidebarPill.classList.add(effectiveClosed ? 'closed' : 'open');
        sidebarPill.innerHTML = effectiveClosed
            ? '<i class="fas fa-circle"></i> Fechada'
            : '<i class="fas fa-circle"></i> Aberta';
    },

    renderHours() {
        const grid = document.getElementById('hoursGrid');
        if (!grid) return;
        grid.innerHTML = '';
        const hours = this.state.hours || this.getDefaultHours();
        this.state.hours = hours;
        this.daysOrder.forEach(d => {
            const row = document.createElement('div');
            row.className = 'hours-row';
            const cfg = hours[d] || { enabled: false, open: '18:00', close: '23:00' };
            // aplicar cor condicional
            if (cfg.enabled) row.classList.add('open'); else row.classList.add('closed');
            row.innerHTML = `
                <div class="hours-day-container">
                    <input type="checkbox" data-day="${d}" data-kind="enabled" ${cfg.enabled ? 'checked' : ''}>
                    <div class="hours-day">${this.dayNames[d]}</div>
                </div>
                <div><input type="time" data-day="${d}" data-kind="open" value="${cfg.open}"></div>
                <div><input type="time" data-day="${d}" data-kind="close" value="${cfg.close}"></div>
            `;
            grid.appendChild(row);
        });
    },

    collectHoursFromUI() {
        const hours = this.state.hours || this.getDefaultHours();
        const inputs = document.querySelectorAll('#hoursGrid input');
        inputs.forEach(input => {
            const day = input.getAttribute('data-day');
            const kind = input.getAttribute('data-kind');
            hours[day] = hours[day] || { enabled: false, open: '18:00', close: '23:00' };
            if (kind === 'enabled') {
                hours[day].enabled = input.checked;
            } else if (kind === 'open') {
                hours[day].open = input.value || '18:00';
            } else if (kind === 'close') {
                hours[day].close = input.value || '23:00';
            }
        });
        this.state.hours = hours;
    },

    isClosedAt(date) {
        // Fechamento manual imediato - tem prioridade absoluta
        if (this.state.closedNow === true) {
            if (this.state.reopenAt) {
                return date < new Date(this.state.reopenAt);
            }
            return true; // Fechada manualmente
        }
        
        // Se não está fechada manualmente, verificar se está explicitamente aberta
        if (this.state.closedNow === false) {
            return false; // Aberta manualmente
        }
        
        // Se closedNow é undefined/null, verificar horários de funcionamento
        const hours = this.state.hours || this.getDefaultHours();
        const d = new Date(date);
        const day = d.getDay();
        const cfg = hours[day];
        // Se o dia não atende (enabled=false), considerar FECHADA
        if (!cfg || !cfg.enabled) return true;
        const [oH,oM] = (cfg.open||'00:00').split(':').map(n=>parseInt(n,10));
        const [cH,cM] = (cfg.close||'23:59').split(':').map(n=>parseInt(n,10));
        const currentMinutes = d.getHours()*60 + d.getMinutes();
        const openMinutes = oH*60 + oM;
        const closeMinutes = cH*60 + cM;
        const openNow = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
        // Fechada quando está fora do horário
        return !openNow;
    },

    isClosedBySchedule(date = new Date()) {
        const hours = this.state.hours || this.getDefaultHours();
        const d = new Date(date);
        const day = d.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
        const cfg = hours[day];
        
        // Se o dia não atende (enabled=false), considerar FECHADA
        if (!cfg || !cfg.enabled) return true;
        
        const [oH, oM] = (cfg.open || '00:00').split(':').map(n => parseInt(n, 10));
        const [cH, cM] = (cfg.close || '23:59').split(':').map(n => parseInt(n, 10));
        const currentMinutes = d.getHours() * 60 + d.getMinutes();
        const openMinutes = oH * 60 + oM;
        const closeMinutes = cH * 60 + cM;
        
        const openNow = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
        // Fechada quando está fora do horário
        return !openNow;
    },

    async load() {
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                console.warn('Token não encontrado');
                this.state = {
                    closedNow: false,
                    reason: '',
                    reopenAt: '',
                    notifyWhatsApp: false,
                    notifyEmail: false,
                    isManualMode: false,
                    hours: this.getDefaultHours()
                };
                return;
            }

            const response = await fetch('/api/admin/store/status', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar status da loja');
            }

            const result = await response.json();
            if (result.sucesso && result.data) {
                const { status, hours } = result.data;
                
                // Converter formato do banco para formato usado no frontend
                this.state = {
                    closedNow: status.closed_now,
                    reason: status.reason || '',
                    reopenAt: status.reopen_at || '',
                    notifyWhatsApp: status.notify_whatsapp,
                    notifyEmail: status.notify_email,
                    isManualMode: status.is_manual_mode || false,
                    hours: hours.map(h => ({
                        enabled: h.enabled,
                        open: h.open,
                        close: h.close
                    }))
                };
                
                console.log('Estado carregado do banco:', this.state);
            } else {
                throw new Error('Resposta inválida do servidor');
            }
        } catch (e) {
            console.warn('Falha ao carregar status do banco:', e);
            // Em caso de erro, usar estado padrão
            this.state = {
                closedNow: false,
                reason: '',
                reopenAt: '',
                notifyWhatsApp: false,
                notifyEmail: false,
                isManualMode: false,
                hours: this.getDefaultHours()
            };
        }
    },

    async save() {
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                console.warn('Token não encontrado');
                return false;
            }

            const response = await fetch('/api/admin/store/status', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    closedNow: this.state.closedNow,
                    reason: this.state.reason,
                    reopenAt: this.state.reopenAt,
                    notifyWhatsApp: this.state.notifyWhatsApp,
                    notifyEmail: this.state.notifyEmail,
                    isManualMode: this.state.isManualMode
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao salvar status da loja');
            }

            const result = await response.json();
            return result.sucesso;
        } catch (e) {
            console.error('Erro ao salvar status:', e);
            return false;
        }
    },

    async saveHours() {
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                console.warn('Token não encontrado');
                return false;
            }

            const response = await fetch('/api/admin/store/hours', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hours: this.state.hours
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao salvar horários');
            }

            const result = await response.json();
            return result.sucesso;
        } catch (e) {
            console.error('Erro ao salvar horários:', e);
            return false;
        }
    },

    async resetHours() {
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                console.warn('Token não encontrado');
                return false;
            }

            const response = await fetch('/api/admin/store/hours/reset', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao resetar horários');
            }

            const result = await response.json();
            return result.sucesso;
        } catch (e) {
            console.error('Erro ao resetar horários:', e);
            return false;
        }
    },

    toLocalDatetime(iso) {
        // Convert ISO to yyyy-MM-ddThh:mm for input value respecting local timezone
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const mi = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }
};

async function initFuncionamentoSection() {
    if (document.getElementById('funcionamento-section')) {
        await statusManager.init();
    }
}

// Instagram Section Management
const instagramManager = {
    state: {
        enabled: false,
        handle: '',
        text: ''
    },

    async init() {
        await this.load();
        this.bindUI();
        this.render();
        this.updatePreview();
    },

    bindUI() {
        const enabledToggle = document.getElementById('instagramEnabled');
        const headerSwitch = document.querySelector('.header-switch');
        const handleInput = document.getElementById('instagramHandle');
        const textInput = document.getElementById('instagramText');
        const saveBtn = document.getElementById('saveInstagramBtn');
        const resetBtn = document.getElementById('resetInstagramBtn');

        // Toggle de ativação/desativação
        enabledToggle?.addEventListener('change', () => {
            this.state.enabled = enabledToggle.checked;
            this.updatePreview();
            this.updateInstagramSection();
        });

        // Clique no container do switch
        headerSwitch?.addEventListener('click', (e) => {
            if (e.target === headerSwitch || e.target.classList.contains('slider')) {
                enabledToggle.checked = !enabledToggle.checked;
                this.state.enabled = enabledToggle.checked;
                this.updatePreview();
                this.updateInstagramSection();
            }
        });

        // Handle do Instagram
        handleInput?.addEventListener('input', () => {
            let value = handleInput.value.replace(/[^a-zA-Z0-9._]/g, '');
            if (value.startsWith('@')) value = value.substring(1);
            handleInput.value = value;
            this.state.handle = value;
            this.updatePreview();
        });

        // Texto de chamada
        textInput?.addEventListener('input', () => {
            this.state.text = textInput.value;
            this.updatePreview();
        });

        // Botão salvar
        saveBtn?.addEventListener('click', async () => {
            try {
                // Simple validation: if enabling, require handle
                if (this.state.enabled && !this.state.handle) {
                    showNotification('Para ativar a seção, informe o usuário do Instagram.', 'warning');
                    return;
                }
                const token = localStorage.getItem('admin_token');
                const res = await fetch('/api/admin/layout/instagram', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        enabled: this.state.enabled,
                        handle: this.state.handle,
                        text: this.state.text
                    })
                });
                const data = await res.json();
                if (!res.ok || data.sucesso === false) throw new Error(data.mensagem || 'Falha ao salvar');
                this.save(); // cache local
                this.updateInstagramSection();
                showNotification('Configurações do Instagram salvas!', 'success');
            } catch (e) {
                showNotification(e.message || 'Erro ao salvar Instagram', 'error');
            }
        });

        // Botão reset
        resetBtn?.addEventListener('click', async () => {
            const confirmed = await customConfirm(
                'Restaurar configurações padrão do Instagram?',
                'Restaurar Instagram',
                'Restaurar',
                'Cancelar'
            );
            
            if (confirmed) {
                // Padrão agora é desativado e sem textos/handle até ser configurado
                this.state = { enabled: false, handle: '', text: '' };
                try {
                    const token = localStorage.getItem('admin_token');
                    const res = await fetch('/api/admin/layout/instagram', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : ''
                        },
                        body: JSON.stringify({ enabled: this.state.enabled, handle: this.state.handle, text: this.state.text })
                    });
                    const data = await res.json();
                    if (!res.ok || data.sucesso === false) throw new Error(data.mensagem || 'Falha ao restaurar');
                } catch(e) {
                    console.warn('Falha ao restaurar no backend, aplicando localmente: ', e);
                }
                this.save();
                this.render();
                this.updatePreview();
                this.updateInstagramSection();
                showNotification('Configurações restauradas!', 'info');
            }
        });
    },

    render() {
        const enabledToggle = document.getElementById('instagramEnabled');
        const handleInput = document.getElementById('instagramHandle');
        const textInput = document.getElementById('instagramText');

        if (enabledToggle) enabledToggle.checked = this.state.enabled;
        if (handleInput) handleInput.value = this.state.handle;
        if (textInput) textInput.value = this.state.text;
    },

    updatePreview() {
        const previewSection = document.querySelector('.instagram-section-preview');
        const previewFollowText = document.getElementById('previewFollowText');
        const previewHandle = document.getElementById('previewHandle');

        if (!previewSection) return;

        // Mostrar/ocultar preview baseado no estado
        previewSection.style.opacity = this.state.enabled ? '1' : '0.3';
        previewSection.style.filter = this.state.enabled ? 'none' : 'grayscale(100%)';
        // Controla hovers idênticos ao site no preview
        previewSection.classList.toggle('enabled', !!this.state.enabled);

        // Atualizar textos do preview
        if (previewFollowText) previewFollowText.textContent = this.state.text || '';
        if (previewHandle) previewHandle.textContent = this.state.handle ? `@${this.state.handle}` : '';
    },

    updateInstagramSection() {
        // Esta função pode ser usada para atualizar a seção real do Instagram
        // no menu.html em tempo real se necessário
        console.log('Instagram section updated:', this.state);
    },

    async load() {
        try {
            // Tenta carregar do backend primeiro
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/layout', {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            const data = await res.json();
            if (res.ok && data.sucesso !== false) {
                const set = data.data || {};
                this.state.enabled = !!set.instagram_enabled;
                this.state.handle = set.instagram_handle || '';
                this.state.text = set.instagram_text || '';
                // sincroniza cache local apenas como espelho do DB, não fonte de verdade
                try { localStorage.setItem('pizzaria_instagram', JSON.stringify(this.state)); } catch(_) {}
                return;
            }
            // fallback localStorage
            const raw = localStorage.getItem('pizzaria_instagram');
            if (raw) this.state = { enabled: false, handle: '', text: '', ...JSON.parse(raw) };
        } catch (e) {
            console.warn('Falha ao carregar configurações do Instagram:', e);
        }
    },

    save() {
        // Sempre persiste no DB via API; localStorage é apenas cache não autoritativo
        try { localStorage.setItem('pizzaria_instagram', JSON.stringify(this.state)); } catch(_) {}
    }
};

// ========== AVALIAÇÕES MANAGER ==========
const reviewsManager = {
    reviews: [],
    average: 0,
    currentFilter: '',
    currentRatingFilter: '',
    isLoading: false,

    async init() {
        this.bindEvents();
        await this.loadFromAPI();
    },

    getToken() { return localStorage.getItem('admin_token'); },

    async apiFetch(path, options = {}) {
        const headers = options.headers || {};
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        headers['Content-Type'] = 'application/json';
        const res = await fetch(path, { ...options, headers });
        const data = await res.json().catch(()=>({}));
        if (!res.ok || data.sucesso === false) {
            throw new Error(data.mensagem || 'Falha ao buscar avaliações');
        }
        return data;
    },

    async loadFromAPI() {
        if (this.isLoading) return;
        this.isLoading = true;
        try {
            const params = new URLSearchParams();
            if (this.currentFilter) params.set('q', this.currentFilter);
            if (this.currentRatingFilter) params.set('rating', this.currentRatingFilter);
            const data = await this.apiFetch(`/api/admin/reviews?${params.toString()}`);
            const list = Array.isArray(data.data?.reviews) ? data.data.reviews : [];
            this.reviews = list.map(r => ({
                id: r.id,
                customerName: r.user_name || `Usuário #${r.user_id}`,
                date: this.formatDate(r.created_at),
                rating: r.rating,
                text: (r.comment || '').length > 180 ? r.comment.slice(0,180) + '…' : (r.comment || ''),
                fullText: r.comment || '',
                productOrdered: 'Pedido #' + r.order_id,
                verified: r.verified
            }));
            this.average = Number(data.data?.average || 0).toFixed(1);
            this.renderReviews();
            this.updateSummary();
        } catch (e) {
            console.error('Erro ao carregar avaliações:', e);
            const container = document.querySelector('.reviews-container');
            if (container) container.innerHTML = '<div class="no-results">Falha ao carregar avaliações</div>';
        } finally {
            this.isLoading = false;
        }
    },

    bindEvents() {
        const searchInput = document.getElementById('reviewSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilter = e.target.value.trim();
                this.debouncedReload();
            });
        }
        const ratingFilter = document.getElementById('ratingFilter');
        if (ratingFilter) {
            ratingFilter.addEventListener('change', (e) => {
                this.currentRatingFilter = e.target.value;
                this.loadFromAPI();
            });
        }
        document.addEventListener('click', (e) => {
            if (e.target.closest('.view-full-review')) {
                const reviewId = parseInt(e.target.closest('.view-full-review').dataset.reviewId,10);
                this.showFullReview(reviewId);
            }
        });
    },

    debouncedReload: (() => {
        let t; return function() { clearTimeout(t); t = setTimeout(()=> this.loadFromAPI(), 400); };
    })(),

    formatDate(dt) {
        if (!dt) return '';
        try {
            const d = new Date(dt);
            if (Number.isNaN(d.getTime())) return dt;
            return d.toLocaleDateString('pt-BR');
        } catch(_) { return dt; }
    },

    renderReviews() {
        const container = document.querySelector('.reviews-container');
        if (!container) return;
        if (!this.reviews.length) {
            container.innerHTML = '<div class="no-results">Nenhuma avaliação encontrada.</div>';
            return;
        }
        const html = this.reviews.map(review => `
            <div class="review-card">
                <div class="review-header">
                    <div class="customer-info">
                        <div class="customer-avatar"><i class="fas fa-user"></i></div>
                        <div class="customer-details">
                            <h4>${review.customerName}</h4>
                            <span class="review-date">${review.date}</span>
                        </div>
                    </div>
                    <div class="rating-stars">${this.generateStars(review.rating)}</div>
                </div>
                <div class="review-content">
                    <p class="review-text">${review.text || '(sem comentário)'}</p>
                </div>
                <div class="review-actions">
                    <button class="view-full-review" data-review-id="${review.id}">
                        <i class="fas fa-eye"></i> Ver completa
                    </button>
                </div>
            </div>`).join('');
        container.innerHTML = html;
    },

    generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) stars += `<i class="fas fa-star ${i <= rating ? 'active' : ''}"></i>`;
        return stars;
    },

    showFullReview(reviewId) {
        const review = this.reviews.find(r => r.id === reviewId);
        if (!review) return;
        const modal = document.createElement('div');
        modal.className = 'review-modal';
        modal.innerHTML = `
            <div class="review-modal-content">
                <div class="review-modal-header">
                    <h3>Avaliação Completa</h3>
                    <button class="close-modal"><i class="fas fa-times"></i></button>
                </div>
                <div class="review-modal-body">
                    <div class="customer-info-modal">
                        <div class="customer-avatar"><i class="fas fa-user"></i></div>
                        <div class="customer-details">
                            <h4>${review.customerName}</h4>
                            <span class="review-date">${review.date}</span>
                            <span class="product-ordered">${review.productOrdered}</span>
                        </div>
                        <div class="rating-stars">${this.generateStars(review.rating)}</div>
                    </div>
                    <div class="full-review-text"><p>${review.fullText || '(sem comentário)'}</p></div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('.close-modal').addEventListener('click', () => document.body.removeChild(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) document.body.removeChild(modal); });
        setTimeout(()=> modal.classList.add('show'), 10);
    },

    updateSummary() {
        const averageElement = document.querySelector('.average-rating');
        const totalElement = document.querySelector('.total-reviews');
        if (averageElement) averageElement.textContent = this.average || '0.0';
        if (totalElement) totalElement.textContent = `(${this.reviews.length} avaliações)`;
    }
};

// ========== CONFIRM MODAL SYSTEM ==========
const confirmModal = {
    modal: null,
    currentResolve: null,
    currentReject: null,

    init() {
        this.modal = document.getElementById('confirmModal');
        if (!this.modal) return;

        // Bind events
        const cancelBtn = document.getElementById('confirmCancel');
        const okBtn = document.getElementById('confirmOk');

        cancelBtn?.addEventListener('click', () => this.hide(false));
        okBtn?.addEventListener('click', () => this.hide(true));

        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide(false);
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.hide(false);
            }
        });
    },

    show(message, title = 'Confirmar ação', okText = 'Confirmar', cancelText = 'Cancelar') {
        return new Promise((resolve, reject) => {
            if (!this.modal) {
                reject(new Error('Modal não encontrado'));
                return;
            }

            this.currentResolve = resolve;
            this.currentReject = reject;

            // Update content
            const titleEl = document.getElementById('confirmTitle');
            const messageEl = document.getElementById('confirmMessage');
            const okBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
            if (okBtn) okBtn.innerHTML = `<i class="fas fa-check"></i> ${okText}`;
            if (cancelBtn) cancelBtn.innerHTML = `<i class="fas fa-times"></i> ${cancelText}`;

            // Show modal
            this.modal.classList.add('show');
            
            // Focus on cancel button by default for safety
            setTimeout(() => cancelBtn?.focus(), 100);
        });
    },

    hide(result) {
        if (!this.modal) return;

        this.modal.classList.remove('show');
        
        if (this.currentResolve) {
            this.currentResolve(result);
            this.currentResolve = null;
            this.currentReject = null;
        }
    }
};

// Custom confirm function to replace native confirm()
async function customConfirm(message, title = 'Confirmar ação', okText = 'Confirmar', cancelText = 'Cancelar') {
    try {
        return await confirmModal.show(message, title, okText, cancelText);
    } catch (error) {
        console.error('Erro no modal de confirmação:', error);
        return false;
    }
}

// ============================================
// DELIVERY MANAGEMENT SYSTEM
// ============================================

class DeliveryManager {
    constructor() {
        this.states = [];
        this.cities = [];
        this.deliveryAreas = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadStates();
        await this.loadAreasFromServer();
        this.renderDeliveryAreas();
        this.updateDeliveryCount();
        await this.renderDeliveryStats();
    }

    getToken() { return localStorage.getItem('admin_token'); }

    async apiFetch(path, options = {}) {
        const headers = options.headers || {};
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        const res = await fetch(path, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.sucesso === false) throw new Error(data.mensagem || `Falha na requisição: ${path}`);
        return data;
    }

    async loadAreasFromServer() {
        try {
            const data = await this.apiFetch('/api/admin/delivery/areas');
            this.deliveryAreas = Array.isArray(data.areas) ? data.areas : [];
        } catch (e) {
            console.error('Erro ao carregar áreas do servidor:', e);
            this.deliveryAreas = [];
        }
    }

    bindEvents() {
        // Form submission
        const form = document.getElementById('deliveryForm');
        if (form) {
            form.addEventListener('submit', this.handleFormSubmit.bind(this));
        }

        // State selection change
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) {
            stateSelect.addEventListener('change', this.handleStateChange.bind(this));
        }

        // Search functionality
        const searchInput = document.getElementById('deliverySearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearch.bind(this));
        }
    }

    async loadStates() {
        try {
            this.showStateLoading();
            const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados');
            
            if (!response.ok) {
                throw new Error('Erro ao carregar estados');
            }

            this.states = await response.json();
            this.states.sort((a, b) => a.nome.localeCompare(b.nome));
            this.populateStates();
            
        } catch (error) {
            console.error('Erro ao carregar estados:', error);
            this.showStateError();
        }
    }

    async loadCities(stateId) {
        try {
            this.showCityLoading();
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateId}/municipios`);
            
            if (!response.ok) {
                throw new Error('Erro ao carregar cidades');
            }

            this.cities = await response.json();
            this.cities.sort((a, b) => a.nome.localeCompare(b.nome));
            this.populateCities();
            
        } catch (error) {
            console.error('Erro ao carregar cidades:', error);
            this.showCityError();
        }
    }

    showStateLoading() {
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) {
            stateSelect.innerHTML = '<option value="">Carregando estados...</option>';
            stateSelect.disabled = true;
        }
    }

    showStateError() {
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) {
            stateSelect.innerHTML = '<option value="">Erro ao carregar estados</option>';
        }
    }

    showCityLoading() {
        const citySelect = document.getElementById('citySelect');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
            citySelect.disabled = true;
        }
    }

    showCityError() {
        const citySelect = document.getElementById('citySelect');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
        }
    }

    populateStates() {
        const stateSelect = document.getElementById('stateSelect');
        if (!stateSelect) return;

        stateSelect.innerHTML = '<option value="">Selecione o estado</option>';
        
        this.states.forEach(state => {
            const option = document.createElement('option');
            option.value = state.id;
            option.textContent = state.nome;
            option.dataset.uf = state.sigla;
            stateSelect.appendChild(option);
        });

        stateSelect.disabled = false;
    }

    populateCities() {
        const citySelect = document.getElementById('citySelect');
        if (!citySelect) return;

        citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
        
        this.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city.id;
            option.textContent = city.nome;
            citySelect.appendChild(option);
        });

        citySelect.disabled = false;
    }

    async handleStateChange(e) {
        const stateId = e.target.value;
        const citySelect = document.getElementById('citySelect');
        
        if (!stateId) {
            citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
            citySelect.disabled = true;
            return;
        }

        await this.loadCities(stateId);
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const stateId = formData.get('state');
        const cityId = formData.get('city');
        const fee = parseFloat(formData.get('fee'));

        if (!stateId || !cityId || isNaN(fee)) {
            showNotification('Preencha todos os campos corretamente', 'error');
            return;
        }

        // Get state and city names
        const selectedState = this.states.find(s => s.id == stateId);
        const selectedCity = this.cities.find(c => c.id == cityId);

        if (!selectedState || !selectedCity) {
            showNotification('Estado ou cidade inválidos', 'error');
            return;
        }

        // Check if area already exists (local)
        const existingArea = this.deliveryAreas.find(area => 
            String(area.stateId) === String(stateId) && String(area.cityId) === String(cityId)
        );

        const payload = {
            stateId: Number(stateId),
            cityId: Number(cityId),
            stateName: selectedState.nome,
            stateUf: selectedState.sigla,
            cityName: selectedCity.nome,
            fee
        };
        if (existingArea) payload.id = existingArea.id;

        // Persist to server
        try {
            const resp = await this.apiFetch('/api/admin/delivery/areas', { method: 'POST', body: JSON.stringify(payload) });
            const saved = resp.area;
            const idx = this.deliveryAreas.findIndex(a => a.id === saved.id);
            if (idx >= 0) this.deliveryAreas[idx] = saved; else this.deliveryAreas.push(saved);
        } catch (err) {
            console.error('Erro ao salvar área:', err);
            showNotification('Erro ao salvar área de entrega', 'error');
            return;
        }

        this.renderDeliveryAreas();
        this.updateDeliveryCount();
        await this.renderDeliveryStats();
        e.target.reset();
        
        // Reset selects
        document.getElementById('citySelect').innerHTML = '<option value="">Selecione a cidade</option>';
        document.getElementById('citySelect').disabled = true;

        showNotification(existingArea ? 'Taxa atualizada com sucesso!' : 'Área de entrega adicionada com sucesso!', 'success');
    }

    async handleDeleteArea(areaId) {
        const area = this.deliveryAreas.find(a => a.id === areaId);
        if (!area) return;

        const confirmed = await customConfirm(
            `Tem certeza que deseja remover a entrega para ${area.cityName} - ${area.stateUf}?`,
            'Remover área de entrega',
            'Remover',
            'Cancelar'
        );

        if (!confirmed) return;

        try {
            await this.apiFetch(`/api/admin/delivery/areas/${areaId}`, { method: 'DELETE' });
        } catch (e) {
            console.error('Erro ao remover área no servidor:', e);
            showNotification('Erro ao remover área no servidor', 'error');
            return;
        }

    this.deliveryAreas = this.deliveryAreas.filter(a => a.id !== areaId);
        this.renderDeliveryAreas();
        this.updateDeliveryCount();
    await this.renderDeliveryStats();
        
        showNotification('Área de entrega removida com sucesso!', 'success');
    }

    handleEditArea(areaId) {
        const area = this.deliveryAreas.find(a => a.id === areaId);
        if (!area) return;

        // Fill form with area data
        const stateSelect = document.getElementById('stateSelect');
        const citySelect = document.getElementById('citySelect');
        const feeInput = document.getElementById('deliveryFee');

        stateSelect.value = area.stateId;
        feeInput.value = area.fee;

        // Load cities and set city
        this.loadCities(area.stateId).then(() => {
            citySelect.value = area.cityId;
        });

        // Scroll to form
        document.querySelector('.delivery-form-card').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    handleSearch(e) {
        const query = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.delivery-item');
        
        items.forEach(item => {
            const location = item.querySelector('.delivery-location').textContent.toLowerCase();
            const state = item.querySelector('.delivery-state').textContent.toLowerCase();
            
            if (location.includes(query) || state.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    renderDeliveryAreas() {
        const container = document.getElementById('deliveryAreasList');
        if (!container) return;

        if (this.deliveryAreas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-truck"></i>
                    <h4>Nenhuma área de entrega configurada</h4>
                    <p>Adicione estados e cidades para começar a configurar suas áreas de entrega</p>
                </div>
            `;
            return;
        }

        // Sort areas by state name then city name
        const sortedAreas = [...this.deliveryAreas].sort((a, b) => {
            if (a.stateName !== b.stateName) {
                return a.stateName.localeCompare(b.stateName);
            }
            return a.cityName.localeCompare(b.cityName);
        });

        container.innerHTML = sortedAreas.map(area => `
            <div class="delivery-item" data-area-id="${area.id}">
                <div class="delivery-info">
                    <div class="delivery-location">${area.cityName}</div>
                    <div class="delivery-state">${area.stateName} - ${area.stateUf}</div>
                </div>
                <div class="delivery-fee">R$ ${area.fee.toFixed(2)}</div>
                <div class="delivery-actions">
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="deliveryManager.handleEditArea(${area.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deliveryManager.handleDeleteArea(${area.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateDeliveryCount() {
        const countElement = document.getElementById('deliveryCount');
        if (countElement) {
            const count = this.deliveryAreas.length;
            countElement.textContent = `${count} ${count === 1 ? 'área' : 'áreas'}`;
        }
    }

    // removed localStorage persistence; data lives on server

    // Public method to get delivery fee for a city
    getDeliveryFee(cityName, stateName) {
        const area = this.deliveryAreas.find(area => 
            area.cityName.toLowerCase() === cityName.toLowerCase() && 
            area.stateName.toLowerCase() === stateName.toLowerCase()
        );
        return area ? area.fee : null;
    }

    async renderDeliveryStats() {
        try {
            const resp = await this.apiFetch('/api/admin/delivery/stats');
            const stats = resp.stats || { totalDeliveries: 0, avgTicket: 0, citiesCount: 0, topCities: [] };

            const totalDeliveriesEl = document.getElementById('totalDeliveries');
            const avgTicketEl = document.getElementById('avgDeliveryValue');
            const citiesCountEl = document.getElementById('topCitiesCount');

            if (totalDeliveriesEl) totalDeliveriesEl.textContent = String(stats.totalDeliveries || 0);
            if (avgTicketEl) avgTicketEl.textContent = `R$ ${(stats.avgTicket || 0).toFixed ? stats.avgTicket.toFixed(2) : Number(stats.avgTicket || 0).toFixed(2)}`;
            if (citiesCountEl) citiesCountEl.textContent = String(stats.citiesCount || 0);

            this.renderTopCities(Array.isArray(stats.topCities) ? stats.topCities : []);
        } catch (e) {
            console.error('Falha ao carregar estatísticas de entrega:', e);
            this.renderEmptyStats();
        }
    }

    renderTopCities(topCities) {
        const container = document.getElementById('topCitiesList');
        if (!container) return;

        if (topCities.length === 0) {
            container.innerHTML = `
                <div class="stats-empty">
                    <i class="fas fa-chart-bar"></i>
                    <h4>Nenhum dado disponível</h4>
                    <p>Configure áreas de entrega para ver as estatísticas</p>
                </div>
            `;
            return;
        }

        container.innerHTML = topCities.map((city, index) => {
            const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
            
            return `
                <div class="city-rank-item">
                    <div class="city-rank-info">
                        <div class="rank-number ${rankClass}">${index + 1}</div>
                        <div class="city-info">
                            <div class="city-name">${city.cityName}</div>
                            <div class="city-state">${city.stateName} - ${city.stateUf}</div>
                        </div>
                    </div>
                    <div class="city-stats">
                        <div class="delivery-count">${city.deliveries ?? 0} entregas</div>
                        <div class="revenue-total">R$ ${(city.revenue ?? 0).toFixed ? city.revenue.toFixed(2) : Number(city.revenue ?? 0).toFixed(2)} em vendas</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderEmptyStats() {
        const container = document.getElementById('topCitiesList');
        if (!container) return;

        // Update overview with zeros
        const totalDeliveriesEl = document.getElementById('totalDeliveries');
        const avgTicketEl = document.getElementById('avgDeliveryValue');
        const citiesCountEl = document.getElementById('topCitiesCount');

    if (totalDeliveriesEl) totalDeliveriesEl.textContent = '0';
    if (avgTicketEl) avgTicketEl.textContent = 'R$ 0,00';
    // Quando não há entregas, não mostrar nenhuma cidade no contador
    if (citiesCountEl) citiesCountEl.textContent = '0';

        container.innerHTML = `
            <div class="stats-empty">
                <i class="fas fa-chart-bar"></i>
                <h4>Nenhuma estatística disponível</h4>
                <p>Configure áreas de entrega para visualizar dados de vendas e entregas</p>
            </div>
        `;
    }
}

// Initialize delivery manager when DOM is loaded
let deliveryManager;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('deliveryForm')) {
        deliveryManager = new DeliveryManager();
    }
});

// Sistema de Notificações legado removido. Agora usamos frontend/assets/js/admin/notifications.js
// O módulo window.notifications é responsável por renderizar, aceitar e fechar notificações.
// A configuração de som é tratada por frontend/assets/js/admin/notification-sound.js
let soundSettings;
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar configurações de som após o módulo de som estar disponível
    setTimeout(() => { try { soundSettings = new SoundSettings(); } catch(_) {} }, 100);
});

/* ============================================
   SOUND SETTINGS SYSTEM - MODERN & INTERACTIVE
   ============================================ */

class SoundSettings {
    constructor() {
        this.currentSound = '../../assets/sounds/notificações1.mp3';
        this.previewAudio = null;
        this.soundEnabled = true;
        this.soundCheckbox = document.getElementById('soundNotifications');
        this.init();
    }

    init() {
        this.setupSoundCheckbox();
        this.setupSoundOptions();
        this.loadSavedSettings();
        this.updateUIState();
    }

    setupSoundCheckbox() {
        if (this.soundCheckbox) {
            this.soundCheckbox.addEventListener('change', () => {
                this.soundEnabled = this.soundCheckbox.checked;
                this.saveSettings();
                this.updateUIState();
                
                // Atualizar módulo de som
                try { window.notificationSound?.setEnabled(this.soundEnabled); } catch(_) {}
                
                console.log('Sound notifications:', this.soundEnabled ? 'enabled' : 'disabled');
            });
        }
    }

    updateUIState() {
        const soundContainer = document.querySelector('.sound-selection-container');
        const soundOptions = document.querySelectorAll('.sound-option');
        const previewButtons = document.querySelectorAll('.sound-preview-btn');
        
        if (this.soundEnabled) {
            // Enable sound selection
            if (soundContainer) soundContainer.classList.remove('disabled');
            soundOptions.forEach(option => {
                option.classList.remove('disabled');
                option.style.pointerEvents = 'auto';
            });
            previewButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.pointerEvents = 'auto';
            });
        } else {
            // Disable sound selection
            if (soundContainer) soundContainer.classList.add('disabled');
            soundOptions.forEach(option => {
                option.classList.add('disabled');
                option.style.pointerEvents = 'none';
            });
            previewButtons.forEach(btn => {
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
            });
            
            // Stop any playing preview
            if (this.previewAudio) {
                this.previewAudio.pause();
                this.previewAudio = null;
            }
            
            // Reset button states
            previewButtons.forEach(btn => {
                btn.classList.remove('playing');
                btn.innerHTML = '<i class="fas fa-play"></i>';
            });
        }
    }

    setupSoundOptions() {
        const soundOptions = document.querySelectorAll('.sound-option');
        const previewButtons = document.querySelectorAll('.sound-preview-btn');

        // Sound option selection
        soundOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                // Don't allow selection if sounds are disabled
                if (!this.soundEnabled) return;
                
                // Don't trigger if clicking preview button
                if (e.target.closest('.sound-preview-btn')) return;
                
                // Remove active class from all options
                soundOptions.forEach(opt => opt.classList.remove('active'));
                
                // Add active class to clicked option
                option.classList.add('active');
                
                // Update current sound
                this.currentSound = option.dataset.sound;
                this.saveSettings();
                
                // Atualizar som do módulo
                try { window.notificationSound?.update(this.currentSound); } catch(_) {}
                console.log('Updated notification sound to:', this.currentSound);
            });
        });

        // Preview buttons
        previewButtons.forEach((button, index) => {
            button.addEventListener('click', (e) => {
                // Don't allow preview if sounds are disabled
                if (!this.soundEnabled) return;
                
                e.stopPropagation();
                const soundOption = button.closest('.sound-option');
                const soundPath = soundOption.dataset.sound;
                this.previewSound(soundPath, button);
            });
        });
    }

    previewSound(soundPath, button) {
        console.log('Trying to preview sound:', soundPath);
        
        // Stop any currently playing preview
        if (this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio.currentTime = 0;
            this.previewAudio = null;
        }

        // Remove playing class from all buttons
        document.querySelectorAll('.sound-preview-btn').forEach(btn => {
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i>';
        });

        // Create new audio instance
        this.previewAudio = new Audio();
        this.previewAudio.volume = 0.7; // Fixed volume at 70%
        this.previewAudio.preload = 'auto';

        // Add playing state
        button.classList.add('playing');
        button.innerHTML = '<i class="fas fa-pause"></i>';

        // Set up event listeners before setting src
        this.previewAudio.addEventListener('loadstart', () => {
            console.log('Audio loading started for:', soundPath);
        });

        this.previewAudio.addEventListener('canplay', () => {
            console.log('Audio can play:', soundPath);
        });

        this.previewAudio.addEventListener('ended', () => {
            console.log('Audio ended:', soundPath);
            this.resetButton(button);
        });

        this.previewAudio.addEventListener('error', (e) => {
            console.log('Audio error for', soundPath, ':', e);
            this.resetButton(button);
            // Try to fallback to a working sound
            if (soundPath !== '../../assets/sounds/notificações1.mp3') {
                console.log('Falling back to notificações1.mp3');
                this.previewSound('../../assets/sounds/notificações1.mp3', button);
            }
        });

        // Set source and play
        this.previewAudio.src = soundPath;
        this.previewAudio.play().catch(error => {
            console.log('Error playing preview sound:', error);
            this.resetButton(button);
        });
    }

    resetButton(button) {
        button.classList.remove('playing');
        button.innerHTML = '<i class="fas fa-play"></i>';
    }

    saveSettings() {
        const settings = {
            sound: this.currentSound,
            enabled: this.soundEnabled
        };
        localStorage.setItem('soundSettings', JSON.stringify(settings));
        console.log('Sound settings saved:', settings);

        // Persistir no backend (não bloqueante)
        try {
            const token = localStorage.getItem('admin_token');
            if (token) {
                fetch('/api/admin/settings/notifications', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        notification_enabled: this.soundEnabled,
                        notification_sound: this.currentSound
                    })
                }).catch(() => {});
            }
        } catch (_) {}
    }

    loadSavedSettings() {
        // Primeiro tenta do backend; fallback para localStorage
        (async () => {
            let appliedFromBackend = false;
            try {
                const token = localStorage.getItem('admin_token');
                if (token) {
                    const resp = await fetch('/api/admin/settings', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (resp.ok) {
                        const json = await resp.json();
                        const data = json?.data;
                        if (data) {
                            if (typeof data.notification_enabled !== 'undefined') {
                                this.soundEnabled = !!data.notification_enabled;
                                if (this.soundCheckbox) this.soundCheckbox.checked = this.soundEnabled;
                            }
                            if (data.notification_sound) {
                                this.currentSound = data.notification_sound;
                                const soundOption = document.querySelector(`[data-sound="${data.notification_sound}"]`);
                                if (soundOption) {
                                    document.querySelectorAll('.sound-option').forEach(opt => opt.classList.remove('active'));
                                    soundOption.classList.add('active');
                                }
                            }
                            try {
                                window.notificationSound?.update(this.currentSound);
                                window.notificationSound?.setEnabled(this.soundEnabled);
                            } catch(_) {}
                            appliedFromBackend = true;
                        }
                    }
                }
            } catch (_) {}

            if (!appliedFromBackend) {
                try {
                    const saved = localStorage.getItem('soundSettings');
                    if (saved) {
                        const settings = JSON.parse(saved);
                        if (typeof settings.enabled !== 'undefined') {
                            this.soundEnabled = settings.enabled;
                            if (this.soundCheckbox) this.soundCheckbox.checked = this.soundEnabled;
                        }
                        if (settings.sound) {
                            this.currentSound = settings.sound;
                            const soundOption = document.querySelector(`[data-sound="${settings.sound}"]`);
                            if (soundOption) {
                                document.querySelectorAll('.sound-option').forEach(opt => opt.classList.remove('active'));
                                soundOption.classList.add('active');
                            }
                            try {
                                window.notificationSound?.update(this.currentSound);
                                window.notificationSound?.setEnabled(this.soundEnabled);
                            } catch(_) {}
                        }
                    } else {
                        this.saveSettings();
                    }
                } catch (error) {
                    console.log('Error loading sound settings:', error);
                }
            }
        })();
    }
}

// Funções para abrir WhatsApp e Maps
function openWhatsApp(phoneNumber) {
    // Remove caracteres especiais e espaços do número
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Adiciona código do país se não tiver (55 para Brasil)
    let formattedPhone = cleanPhone;
    if (!cleanPhone.startsWith('55') && cleanPhone.length === 11) {
        formattedPhone = '55' + cleanPhone;
    } else if (!cleanPhone.startsWith('55') && cleanPhone.length === 10) {
        formattedPhone = '55' + cleanPhone;
    }
    
    // Abre o WhatsApp
    const whatsappUrl = `https://wa.me/${formattedPhone}`;
    window.open(whatsappUrl, '_blank');
}

function openMaps(address) {
    // Codifica o endereço para URL
    const encodedAddress = encodeURIComponent(address);
    
    // Abre o Google Maps
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(mapsUrl, '_blank');
}

// Removidos utilitários de teste de pedido em produção

// Proteção adicional: Verificação periódica de autenticação
(function() {
    const LS_KEY = 'admin_token';
    
    // Verificar autenticação periodicamente (a cada 60s) com proteção anti-loop
    let __authCheckRunning = false;
    setInterval(async function() {
        if (__authCheckRunning) return;
        __authCheckRunning = true;
        const isLoginPage = window.location.pathname.includes('admin-login');
        if (isLoginPage) return;
        
        const token = localStorage.getItem(LS_KEY);
        if (!token) {
            // Redirecionar suavemente apenas se não estivermos indo para login já
            if (!window.location.pathname.includes('admin-login')) {
                window.location.replace('/admin-login');
            }
            __authCheckRunning = false;
            return; 
        }
        
        try {
            const response = await fetch('/api/admin/auth/verificar', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                localStorage.clear();
                sessionStorage.clear();
                if (!window.location.pathname.includes('admin-login')) {
                    window.location.replace('/admin-login');
                }
            }
        } catch (error) {
            console.error('Erro na verificação periódica:', error);
            localStorage.clear();
            sessionStorage.clear();
            if (!window.location.pathname.includes('admin-login')) {
                window.location.replace('/admin-login');
            }
        }
        __authCheckRunning = false;
    }, 60000); // 60 segundos
    
    // Proteção contra inatividade (15 minutos)
    let lastActivity = Date.now();
    
    function updateActivity() {
        lastActivity = Date.now();
    }
    
    // Eventos que indicam atividade do usuário
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(function(event) {
        document.addEventListener(event, updateActivity, true);
    });
    
    // Verificar inatividade a cada minuto
    setInterval(function() {
        const isLoginPage = window.location.pathname.includes('admin-login');
        if (isLoginPage) return;
        
        const inactiveTime = Date.now() - lastActivity;
        const maxInactiveTime = 15 * 60 * 1000; // 15 minutos
        
        if (inactiveTime > maxInactiveTime) {
            alert('Sessão expirada por inatividade. Você será redirecionado para o login.');
            window.__adminLogout();
        }
    }, 60000); // 1 minuto
    
    // Proteger contra abertura em múltiplas abas
    const tabId = sessionStorage.getItem('admin_tab_id') || Date.now().toString();
    sessionStorage.setItem('admin_tab_id', tabId);
    
    window.addEventListener('storage', function(e) {
        if (e.key === 'admin_tab_id' && e.newValue !== tabId) {
            alert('Dashboard já está aberto em outra aba. Esta aba será fechada.');
            window.close();
        }
    });
    
    localStorage.setItem('admin_tab_id', tabId);
})();
