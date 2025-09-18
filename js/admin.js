// Estado global da aplicação
let currentSection = 'dashboard';
let products = [];
let orders = [];
let clients = [];
let charts = {};

// Dados mockados para demonstração
const mockData = {
    orders: [
        {
            id: '001',
            cliente: 'João Silva',
            data: '2025-09-18T10:30:00',
            items: [
                { nome: 'Pizza Calabresa (Grande)', quantidade: 1, preco: 27.99 }
            ],
            total: 32.99,
            status: 'pending',
            endereco: 'Rua das Flores, 123',
            telefone: '(11) 99999-1111'
        },
        {
            id: '002',
            cliente: 'Maria Santos',
            data: '2025-09-18T10:18:00',
            items: [
                { nome: 'Pizza 4 Queijos (Grande)', quantidade: 1, preco: 47.99 },
                { nome: 'Coca-cola (2L)', quantidade: 1, preco: 8.90 }
            ],
            total: 61.89,
            status: 'delivered',
            endereco: 'Av. Paulista, 456',
            telefone: '(11) 99999-2222'
        },
        {
            id: '003',
            cliente: 'Pedro Costa',
            data: '2025-09-18T10:12:00',
            items: [
                { nome: 'Pizza Portuguesa (Grande)', quantidade: 2, preco: 35.99 }
            ],
            total: 76.98,
            status: 'preparing',
            endereco: 'Rua do Comércio, 789',
            telefone: '(11) 99999-3333'
        }
    ],
    clients: [
        {
            id: 1,
            nome: 'João Silva',
            email: 'joao@email.com',
            telefone: '(11) 99999-1111',
            pedidos: 15,
            totalGasto: 567.80,
            ultimoPedido: '2025-09-18'
        },
        {
            id: 2,
            nome: 'Maria Santos',
            email: 'maria@email.com',
            telefone: '(11) 99999-2222',
            pedidos: 22,
            totalGasto: 890.50,
            ultimoPedido: '2025-09-18'
        },
        {
            id: 3,
            nome: 'Pedro Costa',
            email: 'pedro@email.com',
            telefone: '(11) 99999-3333',
            pedidos: 8,
            totalGasto: 345.20,
            ultimoPedido: '2025-09-17'
        }
    ]
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    loadProductsFromAPI();
    setupEventListeners();
    setupCharts();
    loadMockData();
    showSection('dashboard');
    
    // Configurar layout inicial baseado no tamanho da tela
    handleResize();
    
    // Adicionar loading overlay inicial se necessário
    removeLoadingState();
}

// Remover estado de carregamento
function removeLoadingState() {
    const loadingElements = document.querySelectorAll('.loading, .skeleton');
    loadingElements.forEach(element => {
        element.classList.remove('loading', 'skeleton');
    });
}

// Carregar produtos da API existente
async function loadProductsFromAPI() {
    try {
        const response = await fetch('./apiData.json');
        const data = await response.json();
        
        // Combinar pizzas e bebidas
        products = [
            ...data.pizzas.map(pizza => ({ ...pizza, category: 'pizza', status: 'active' })),
            ...data.drinks.map(drink => ({ ...drink, category: 'drink', status: 'active' }))
        ];
        
        renderProductsTable();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        // Fallback para produtos mockados
        products = [
            {
                id: 1,
                name: 'Pizza Calabresa',
                description: 'Molho, muçarela, calabresa fatiada, cebola fatiada e orégano.',
                price: [14.5, 19.99, 27.99],
                sizes: ['320g', '530g', '860g'],
                img: 'images/calabresa.png',
                category: 'pizza',
                status: 'active'
            }
        ];
        renderProductsTable();
    }
}

// Carregar dados mockados
function loadMockData() {
    orders = mockData.orders;
    clients = mockData.clients;
    renderOrdersTable();
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
    document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => loadMockData());
    document.getElementById('addClientBtn')?.addEventListener('click', () => openClientModal());

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
    document.querySelectorAll('.config-form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            showNotification('Configurações salvas com sucesso!', 'success');
        });
    });
}

// Mostrar seção
function showSection(sectionName) {
    // Esconder todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar seção selecionada
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
        
        // Atualizar título da página
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            const titles = {
                dashboard: 'Dashboard',
                produtos: 'Produtos',
                pedidos: 'Pedidos',
                relatorios: 'Relatórios',
                clientes: 'Clientes',
                configuracoes: 'Configurações'
            };
            pageTitle.textContent = titles[sectionName] || 'Admin Panel';
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
    
    // Gráfico de vendas do dashboard
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        charts.sales = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
                datasets: [{
                    label: 'Vendas (R$)',
                    data: [1200, 1900, 800, 1500, 2000, 3000, 2500],
                    borderColor: '#fab427',
                    backgroundColor: 'rgba(250, 180, 39, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: window.innerWidth <= 768 ? 2 : 4,
                    pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                    borderWidth: window.innerWidth <= 768 ? 2 : 3
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
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: window.innerWidth <= 768 ? 10 : 12
                            }
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: window.innerWidth <= 768 ? 10 : 12
                            },
                            callback: function(value) {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverBackgroundColor: '#fab427'
                    }
                }
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
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
                datasets: [{
                    label: 'Vendas',
                    data: [12000, 15000, 18000, 14000, 20000, 22000],
                    backgroundColor: '#fab427',
                    borderRadius: isMobile ? 4 : 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
                labels: ['Calabresa', '4 Queijos', 'Portuguesa', 'Margherita'],
                datasets: [{
                    data: [30, 25, 20, 15],
                    backgroundColor: ['#fab427', '#28a745', '#17a2b8', '#6c757d'],
                    borderWidth: 0,
                    cutout: isMobile ? '60%' : '70%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'right',
                        labels: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            padding: isMobile ? 10 : 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
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
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
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
                labels: ['18h', '19h', '20h', '21h', '22h', '23h'],
                datasets: [{
                    label: 'Pedidos',
                    data: [5, 15, 25, 30, 20, 8],
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
    }
}

function updateReportsCharts() {
    // Atualizar dados dos gráficos baseado no período selecionado
    const activePeriod = document.querySelector('.period-btn.active')?.dataset.period || '7';
    
    // Aqui você implementaria a lógica para buscar dados do período
    console.log('Atualizando gráficos para período:', activePeriod);
}

// Renderizar tabela de produtos
function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${product.img}" alt="${product.name}" class="product-img">
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
            pending: 'Pendente',
            preparing: 'Preparando',
            delivery: 'A caminho',
            delivered: 'Entregue',
            cancelled: 'Cancelado'
        };

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
                    <button class="action-btn edit" onclick="updateOrderStatus('${order.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Renderizar tabela de clientes
function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.nome}</td>
            <td>${client.email}</td>
            <td>${client.telefone}</td>
            <td>${client.pedidos}</td>
            <td>R$ ${client.totalGasto.toFixed(2)}</td>
            <td>${formatDate(client.ultimoPedido)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editClient(${client.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteClient(${client.id})">
                        <i class="fas fa-trash"></i>
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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${product.img}" alt="${product.name}" class="product-img">
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
        pending: 'Pendente',
        preparing: 'Preparando',
        delivery: 'A caminho',
        delivered: 'Entregue',
        cancelled: 'Cancelado'
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
                    <button class="action-btn edit" onclick="updateOrderStatus('${order.id}')">
                        <i class="fas fa-edit"></i>
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

    filteredClients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.nome}</td>
            <td>${client.email}</td>
            <td>${client.telefone}</td>
            <td>${client.pedidos}</td>
            <td>R$ ${client.totalGasto.toFixed(2)}</td>
            <td>${formatDate(client.ultimoPedido)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editClient(${client.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteClient(${client.id})">
                        <i class="fas fa-trash"></i>
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
    } else {
        title.textContent = 'Adicionar Produto';
        form.reset();
        delete form.dataset.editId;
    }

    modal.classList.add('show');
}

function saveProduct() {
    const form = document.getElementById('productForm');
    const formData = new FormData(form);
    
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
        img: 'images/pizza-desenho.png', // Placeholder
        status: 'active'
    };

    if (form.dataset.editId) {
        // Editar produto existente
        const id = parseInt(form.dataset.editId);
        const index = products.findIndex(p => p.id === id);
        products[index] = { ...products[index], ...productData };
    } else {
        // Adicionar novo produto
        productData.id = Math.max(...products.map(p => p.id)) + 1;
        products.push(productData);
    }

    renderProductsTable();
    closeModal('productModal');
    showNotification('Produto salvo com sucesso!', 'success');
}

function editProduct(id) {
    openProductModal(id);
}

function deleteProduct(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        products = products.filter(p => p.id !== id);
        renderProductsTable();
        showNotification('Produto excluído com sucesso!', 'success');
    }
}

// Funções de pedido
function viewOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
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
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pendente</option>
                    <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparando</option>
                    <option value="delivery" ${order.status === 'delivery' ? 'selected' : ''}>A caminho</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Entregue</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                </select>
                <button class="btn-primary" onclick="updateOrderStatusFromModal('${orderId}')">
                    Atualizar Status
                </button>
            </div>
        </div>
    `;

    modal.classList.add('show');
}

function updateOrderStatus(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newStatus = prompt('Novo status (pending/preparing/delivery/delivered/cancelled):', order.status);
    if (newStatus && ['pending', 'preparing', 'delivery', 'delivered', 'cancelled'].includes(newStatus)) {
        order.status = newStatus;
        renderOrdersTable();
        showNotification('Status do pedido atualizado!', 'success');
    }
}

function updateOrderStatusFromModal(orderId) {
    const newStatus = document.getElementById('newStatus').value;
    const order = orders.find(o => o.id === orderId);
    
    if (order) {
        order.status = newStatus;
        renderOrdersTable();
        closeModal('orderModal');
        showNotification('Status do pedido atualizado!', 'success');
    }
}

// Funções de cliente
function openClientModal(clientId = null) {
    // Implementar modal de cliente
    showNotification('Funcionalidade em desenvolvimento', 'info');
}

function editClient(id) {
    openClientModal(id);
}

function deleteClient(id) {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
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
    const statusTexts = {
        pending: 'Pendente',
        preparing: 'Preparando',
        delivery: 'A caminho',
        delivered: 'Entregue',
        cancelled: 'Cancelado'
    };
    return statusTexts[status] || status;
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
        border-top: 2px solid #fab427;
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
