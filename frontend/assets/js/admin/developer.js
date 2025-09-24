// JavaScript da Seção de Desenvolvedor - Inicialização Controlada
window.initDeveloperSection = (function() {
    'use strict';

    const LS_KEY = 'admin_token';
    let currentPage = 1;
    let currentFilters = {};
    let refreshInterval;
    let isInitialized = false;

    // Verificação de segurança (já foi validado pelo admin.js)
    async function verificarAcessoSuperAdmin() {
        try {
            const token = localStorage.getItem(LS_KEY);
            if (!token) return false;

            const response = await fetch('/api/admin/auth/verificar', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return false;
            const data = await response.json();
            return data.admin?.super_admin === true;
        } catch (error) {
            console.error('Erro na verificação de acesso:', error);
            return false;
        }
    }

    // Função de inicialização principal (exportada)
    async function init() {
        // Evitar inicialização duplicada
        if (isInitialized) return;
        
        // Validação de segurança 
        const acessoValido = await verificarAcessoSuperAdmin();
        if (!acessoValido) {
            alert('Acesso negado à seção de desenvolvedor!');
            return;
        }

        try {
            await carregarDashboard();
            inicializarEventListeners();
            iniciarAtualizacaoAutomatica();
            isInitialized = true;
            console.log('Seção de desenvolvedor inicializada com sucesso');
        } catch (error) {
            console.error('Erro na inicialização da seção de desenvolvedor:', error);
            mostrarErro('Erro ao inicializar seção de desenvolvedor');
        }
    }

    // Carregar dashboard inicial
    async function carregarDashboard() {
        try {
            showLoader();
            const token = localStorage.getItem(LS_KEY);
            
            const response = await fetch('/api/admin/developer/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar dashboard');
            }

            const data = await response.json();
            
            if (data.sucesso) {
                atualizarStatusCards(data.dados.status_geral.componentes);
                atualizarEstatisticas(data.dados);
                await atualizarInformacoesTecnicas(data.dados);
                atualizarUltimaAtualizacao();
                await carregarLogs();
            }

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            mostrarErro('Erro ao carregar dados do dashboard');
        } finally {
            hideLoader();
        }
    }

    // Atualizar cards de status
    function atualizarStatusCards(componentes) {
        componentes.forEach(componente => {
            const card = document.getElementById(`${componente.component}-status`);
            if (!card) return;

            const badge = card.querySelector('.status-badge');
            const details = card.querySelector('.status-details');

            badge.textContent = getStatusText(componente.status);
            badge.className = `status-badge ${componente.status}`;
            details.textContent = componente.message || 'Sem informações adicionais';

            // Atualizar ícone baseado no status
            const icon = card.querySelector('.status-icon');
            icon.className = `status-icon ${componente.status}`;
        });
    }

    // Converter status para texto
    function getStatusText(status) {
        const statusMap = {
            'online': 'Online',
            'offline': 'Offline',
            'degraded': 'Degradado',
            'maintenance': 'Manutenção'
        };
        return statusMap[status] || status;
    }

    // Atualizar estatísticas
    function atualizarEstatisticas(dados) {
        // Uptime do servidor
        const uptime = dados.info_servidor?.uptime || 0;
        document.getElementById('server-uptime').textContent = formatarUptime(uptime);

        // Uso de memória
        const memoria = dados.info_servidor?.memoria;
        if (memoria) {
            const usedMB = Math.round(memoria.heapUsed / 1024 / 1024);
            const totalMB = Math.round(memoria.heapTotal / 1024 / 1024);
            document.getElementById('memory-usage').textContent = `${usedMB}MB / ${totalMB}MB`;
        }

        // Conexões do banco (será implementado quando disponível)
        document.getElementById('db-connections').textContent = 'N/A';

        // Logs de erro dos últimos 7 dias
        const logsError = dados.estatisticas_logs?.filter(log => log.level === 'error').length || 0;
        document.getElementById('error-logs-count').textContent = logsError;
    }

    // Atualizar informações técnicas
    async function atualizarInformacoesTecnicas(dados) {
        const infoServidor = dados.info_servidor;
        if (infoServidor) {
            document.getElementById('node-version').textContent = infoServidor.versao_node || 'N/A';
            document.getElementById('platform').textContent = infoServidor.plataforma || 'N/A';
            document.getElementById('process-id').textContent = infoServidor.pid || 'N/A';
        }

        // Buscar informações detalhadas do banco de dados
        try {
            const token = localStorage.getItem(LS_KEY);
            const response = await fetch('/api/admin/developer/tech-info', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.sucesso && data.dados.banco_dados) {
                    const dbInfo = data.dados.banco_dados;
                    document.getElementById('db-version').textContent = dbInfo.versao;
                    document.getElementById('db-connections-total').textContent = dbInfo.conexoes_ativas;
                    document.getElementById('db-uptime').textContent = dbInfo.uptime;
                } else {
                    // Em caso de erro, mostrar erro
                    document.getElementById('db-version').textContent = 'Erro ao carregar';
                    document.getElementById('db-connections-total').textContent = 'Erro ao carregar';
                    document.getElementById('db-uptime').textContent = 'Erro ao carregar';
                }
            } else {
                throw new Error('Erro na resposta da API');
            }
        } catch (error) {
            console.error('Erro ao carregar informações do banco:', error);
            document.getElementById('db-version').textContent = 'Erro de conexão';
            document.getElementById('db-connections-total').textContent = 'N/A';
            document.getElementById('db-uptime').textContent = 'N/A';
        }
    }

    // Carregar logs
    async function carregarLogs(pagina = 1) {
        try {
            const logsLoading = document.getElementById('logs-loading');
            const logsList = document.getElementById('logs-list');
            
            logsLoading.style.display = 'flex';
            logsList.style.display = 'none';

            const token = localStorage.getItem(LS_KEY);
            const params = new URLSearchParams({
                pagina: pagina,
                limite: 20,
                ...currentFilters
            });

            const response = await fetch(`/api/admin/developer/logs?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar logs');
            }

            const data = await response.json();
            
            if (data.sucesso) {
                renderizarLogs(data.dados.logs);
                renderizarPaginacao(data.dados.paginacao);
                currentPage = pagina;
            }

        } catch (error) {
            console.error('Erro ao carregar logs:', error);
            mostrarErro('Erro ao carregar logs');
        } finally {
            document.getElementById('logs-loading').style.display = 'none';
            document.getElementById('logs-list').style.display = 'block';
        }
    }

    // Renderizar logs
    function renderizarLogs(logs) {
        const logsList = document.getElementById('logs-list');
        
        if (logs.length === 0) {
            logsList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Nenhum log encontrado com os filtros aplicados</p>
                </div>
            `;
            return;
        }

        logsList.innerHTML = logs.map(log => `
            <div class="log-entry">
                <span class="log-level ${log.level}">${log.level}</span>
                <div class="log-content">
                    <p class="log-message">${escapeHtml(log.message)}</p>
                    <div class="log-meta">
                        <span><i class="fas fa-clock"></i> ${formatarDataHora(log.created_at)}</span>
                        ${log.source ? `<span><i class="fas fa-tag"></i> ${escapeHtml(log.source)}</span>` : ''}
                        ${log.admin_nome ? `<span><i class="fas fa-user"></i> ${escapeHtml(log.admin_nome)}</span>` : ''}
                        ${log.ip_address ? `<span><i class="fas fa-globe"></i> ${escapeHtml(log.ip_address)}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Renderizar paginação
    function renderizarPaginacao(paginacao) {
        const container = document.getElementById('logs-pagination');
        
        if (paginacao.total_paginas <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        
        // Botão anterior
        html += `
            <button class="pagination-btn" 
                    ${paginacao.pagina_atual === 1 ? 'disabled' : ''} 
                    onclick="carregarLogs(${paginacao.pagina_atual - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Páginas
        const startPage = Math.max(1, paginacao.pagina_atual - 2);
        const endPage = Math.min(paginacao.total_paginas, paginacao.pagina_atual + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="pagination-btn ${i === paginacao.pagina_atual ? 'active' : ''}" 
                        onclick="carregarLogs(${i})">
                    ${i}
                </button>
            `;
        }

        // Botão próximo
        html += `
            <button class="pagination-btn" 
                    ${paginacao.pagina_atual === paginacao.total_paginas ? 'disabled' : ''} 
                    onclick="carregarLogs(${paginacao.pagina_atual + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        container.innerHTML = html;
    }

    // Event listeners
    function inicializarEventListeners() {
        // Botão de refresh de status
        document.getElementById('btn-refresh-status').addEventListener('click', async () => {
            await verificarStatusSistema();
        });

        // Filtros de logs
        document.getElementById('log-level-filter').addEventListener('change', (e) => {
            currentFilters.level = e.target.value;
            carregarLogs(1);
        });

        document.getElementById('log-source-filter').addEventListener('change', (e) => {
            currentFilters.source = e.target.value;
            carregarLogs(1);
        });

        // Botão de limpar logs
        document.getElementById('btn-clear-logs').addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja limpar logs antigos? Esta ação não pode ser desfeita.')) {
                await limparLogs();
            }
        });
    }

    // Verificar status do sistema
    async function verificarStatusSistema() {
        try {
            const btn = document.getElementById('btn-refresh-status');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

            const token = localStorage.getItem(LS_KEY);
            const response = await fetch('/api/admin/developer/status/verificar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro na verificação');
            }

            const data = await response.json();
            
            if (data.sucesso) {
                atualizarStatusCards(data.dados.status_geral.componentes);
                atualizarUltimaAtualizacao();
                mostrarSucesso('Status atualizado com sucesso');
            }

        } catch (error) {
            console.error('Erro ao verificar status:', error);
            mostrarErro('Erro ao verificar status do sistema');
        } finally {
            const btn = document.getElementById('btn-refresh-status');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Verificar Novamente';
        }
    }

    // Limpar logs antigos
    async function limparLogs() {
        try {
            const token = localStorage.getItem(LS_KEY);
            const response = await fetch('/api/admin/developer/logs/limpar', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dias: 30 })
            });

            if (!response.ok) {
                throw new Error('Erro ao limpar logs');
            }

            const data = await response.json();
            
            if (data.sucesso) {
                mostrarSucesso(data.mensagem);
                await carregarLogs(1);
            }

        } catch (error) {
            console.error('Erro ao limpar logs:', error);
            mostrarErro('Erro ao limpar logs');
        }
    }

    // Atualização automática
    function iniciarAtualizacaoAutomatica() {
        // Atualizar status a cada 30 segundos
        refreshInterval = setInterval(async () => {
            try {
                const token = localStorage.getItem(LS_KEY);
                const response = await fetch('/api/admin/developer/status', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.sucesso) {
                        atualizarStatusCards(data.dados.status_geral.componentes);
                        atualizarUltimaAtualizacao();
                    }
                }
            } catch (error) {
                console.error('Erro na atualização automática:', error);
            }
        }, 30000);
    }

    // Helpers
    function formatarUptime(segundos) {
        const dias = Math.floor(segundos / 86400);
        const horas = Math.floor((segundos % 86400) / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);

        if (dias > 0) {
            return `${dias}d ${horas}h ${minutos}m`;
        } else if (horas > 0) {
            return `${horas}h ${minutos}m`;
        } else {
            return `${minutos}m`;
        }
    }

    function formatarDataHora(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function atualizarUltimaAtualizacao() {
        const now = new Date();
        document.getElementById('last-update-time').textContent = 
            `Última atualização: ${now.toLocaleTimeString('pt-BR')}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoader() {
        document.querySelector('.loader-content').style.display = 'flex';
    }

    function hideLoader() {
        document.querySelector('.loader-content').style.display = 'none';
    }

    function mostrarSucesso(mensagem) {
        // Implementar toast/notificação de sucesso
        console.log('Sucesso:', mensagem);
    }

    function mostrarErro(mensagem) {
        // Implementar toast/notificação de erro
        console.error('Erro:', mensagem);
    }

    // Limpeza da seção
    function cleanup() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        isInitialized = false;
    }

    // Expor funções globais para os botões
    window.carregarLogs = carregarLogs;
    window.cleanupDeveloperSection = cleanup;

    // Retornar função de inicialização
    return init;
})();