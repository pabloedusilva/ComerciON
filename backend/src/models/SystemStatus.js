// Model SystemStatus - Monitoramento do status dos componentes do sistema
const { pool } = require('../config/database');

class SystemStatus {
    constructor(data) {
        this.id = data.id;
        this.component = data.component;
        this.status = data.status;
        this.message = data.message;
        this.metadata = data.metadata;
        this.last_check = data.last_check;
        this.updated_at = data.updated_at;
    }

    // Atualizar status de um componente
    static async atualizarStatus(component, status, message = null, metadata = null) {
        try {
            const metadataJson = metadata ? JSON.stringify(metadata) : null;
            
            const query = `
                INSERT INTO system_status (component, status, message, metadata, last_check) 
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    status = VALUES(status),
                    message = VALUES(message),
                    metadata = VALUES(metadata),
                    last_check = NOW(),
                    updated_at = NOW()
            `;

            await pool.execute(query, [component, status, message, metadataJson]);
            
            return await SystemStatus.buscarPorComponente(component);
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            throw new Error(`Erro ao atualizar status: ${error.message}`);
        }
    }

    // Buscar status por componente
    static async buscarPorComponente(component) {
        try {
            const query = 'SELECT * FROM system_status WHERE component = ?';
            const [rows] = await pool.execute(query, [component]);
            
            if (rows.length === 0) return null;
            
            const status = rows[0];
            if (status.metadata) {
                try {
                    // Tentar fazer parse apenas se for string válida
                    if (typeof status.metadata === 'string' && status.metadata.trim()) {
                        status.metadata = JSON.parse(status.metadata);
                    } else if (typeof status.metadata === 'object') {
                        // Se já é objeto, manter como está
                        status.metadata = status.metadata;
                    } else {
                        // Se for null, undefined ou string vazia
                        status.metadata = null;
                    }
                } catch (jsonError) {
                    console.warn(`JSON inválido no status ${component}:`, status.metadata, jsonError.message);
                    status.metadata = { 
                        erro_parse: true, 
                        valor_original: status.metadata,
                        erro: jsonError.message 
                    };
                }
            }
            
            return new SystemStatus(status);
        } catch (error) {
            throw new Error(`Erro ao buscar status: ${error.message}`);
        }
    }

    // Listar todos os status
    static async listarTodos() {
        try {
            const query = 'SELECT * FROM system_status ORDER BY component';
            const [rows] = await pool.execute(query);
            
            return rows.map(row => {
                if (row.metadata) {
                    try {
                        // Tentar fazer parse apenas se for string válida
                        if (typeof row.metadata === 'string' && row.metadata.trim()) {
                            row.metadata = JSON.parse(row.metadata);
                        } else if (typeof row.metadata === 'object') {
                            // Se já é objeto, manter como está
                            row.metadata = row.metadata;
                        } else {
                            // Se for null, undefined ou string vazia
                            row.metadata = null;
                        }
                    } catch (jsonError) {
                        console.warn(`JSON inválido no status ${row.component}:`, row.metadata, jsonError.message);
                        row.metadata = { 
                            erro_parse: true, 
                            valor_original: row.metadata,
                            erro: jsonError.message 
                        };
                    }
                }
                return new SystemStatus(row);
            });
        } catch (error) {
            throw new Error(`Erro ao listar status: ${error.message}`);
        }
    }

    // Verificar status geral do sistema
    static async verificarStatusGeral() {
        try {
            const componentes = await SystemStatus.listarTodos();
            
            const estatisticas = {
                total: componentes.length,
                online: 0,
                offline: 0,
                degraded: 0,
                maintenance: 0
            };

            componentes.forEach(comp => {
                estatisticas[comp.status]++;
            });

            const statusGeral = estatisticas.offline > 0 ? 'degraded' : 
                               estatisticas.degraded > 0 ? 'degraded' : 
                               estatisticas.maintenance > 0 ? 'maintenance' : 'online';

            return {
                status_geral: statusGeral,
                componentes,
                estatisticas,
                ultima_verificacao: new Date()
            };
        } catch (error) {
            throw new Error(`Erro ao verificar status geral: ${error.message}`);
        }
    }

    // Verificar status do banco de dados
    static async verificarDatabase() {
        try {
            const inicio = Date.now();
            
            // Teste simples de conexão
            await pool.execute('SELECT 1 as test');
            
            const latencia = Date.now() - inicio;
            
            const metadata = {
                latencia_ms: latencia,
                ultima_verificacao: new Date()
            };

            await SystemStatus.atualizarStatus(
                'database',
                latencia > 1000 ? 'degraded' : 'online',
                latencia > 1000 ? `Alta latência: ${latencia}ms` : `Funcionando normalmente (${latencia}ms)`,
                metadata
            );

            return true;
        } catch (error) {
            await SystemStatus.atualizarStatus(
                'database',
                'offline',
                `Erro de conexão: ${error.message}`,
                { erro: error.message, ultima_verificacao: new Date() }
            );
            return false;
        }
    }

    // Verificar status do servidor
    static async verificarServer() {
        try {
            const uptime = process.uptime();
            const memoria = process.memoryUsage();
            
            const metadata = {
                uptime_segundos: Math.floor(uptime),
                uptime_formatado: SystemStatus.formatarUptime(uptime),
                memoria: {
                    rss_mb: Math.round(memoria.rss / 1024 / 1024),
                    heap_usado_mb: Math.round(memoria.heapUsed / 1024 / 1024),
                    heap_total_mb: Math.round(memoria.heapTotal / 1024 / 1024)
                },
                versao_node: process.version,
                plataforma: process.platform,
                pid: process.pid
            };

            await SystemStatus.atualizarStatus(
                'server',
                'online',
                `Servidor ativo há ${metadata.uptime_formatado}`,
                metadata
            );

            return true;
        } catch (error) {
            await SystemStatus.atualizarStatus(
                'server',
                'offline',
                `Erro no servidor: ${error.message}`,
                { erro: error.message }
            );
            return false;
        }
    }

    // Verificar status da API de pagamentos (placeholder)
    static async verificarPaymentAPI() {
        try {
            // TODO: Implementar verificação real quando integrar com Mercado Pago ou Infinity Pay
            const metadata = {
                provider: 'none',
                configurado: false,
                ultima_verificacao: new Date()
            };

            await SystemStatus.atualizarStatus(
                'payment_api',
                'offline',
                'API de pagamentos não configurada',
                metadata
            );

            return false;
        } catch (error) {
            await SystemStatus.atualizarStatus(
                'payment_api',
                'offline',
                `Erro na API de pagamentos: ${error.message}`,
                { erro: error.message }
            );
            return false;
        }
    }

    // Verificar status do Redis (se configurado)
    static async verificarRedis() {
        try {
            // TODO: Implementar verificação do Redis quando estiver configurado
            const metadata = {
                configurado: false,
                ultima_verificacao: new Date()
            };

            await SystemStatus.atualizarStatus(
                'redis',
                'offline',
                'Redis não configurado',
                metadata
            );

            return false;
        } catch (error) {
            await SystemStatus.atualizarStatus(
                'redis',
                'offline',
                `Erro no Redis: ${error.message}`,
                { erro: error.message }
            );
            return false;
        }
    }

    // Executar verificação completa de todos os componentes
    static async verificarTodosComponentes() {
        try {
            const resultados = await Promise.allSettled([
                SystemStatus.verificarDatabase(),
                SystemStatus.verificarServer(),
                SystemStatus.verificarPaymentAPI(),
                SystemStatus.verificarRedis()
            ]);

            const sucessos = resultados.filter(r => r.status === 'fulfilled' && r.value === true).length;
            const total = resultados.length;

            return {
                sucesso: true,
                componentes_verificados: total,
                componentes_online: sucessos,
                porcentagem_saude: Math.round((sucessos / total) * 100)
            };
        } catch (error) {
            throw new Error(`Erro na verificação geral: ${error.message}`);
        }
    }

    // Helper para formatar uptime
    static formatarUptime(segundos) {
        const dias = Math.floor(segundos / 86400);
        const horas = Math.floor((segundos % 86400) / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        const segs = Math.floor(segundos % 60);

        if (dias > 0) {
            return `${dias}d ${horas}h ${minutos}m`;
        } else if (horas > 0) {
            return `${horas}h ${minutos}m`;
        } else if (minutos > 0) {
            return `${minutos}m ${segs}s`;
        } else {
            return `${segs}s`;
        }
    }
}

module.exports = SystemStatus;