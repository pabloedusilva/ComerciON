// Controller Developer - Seção de desenvolvedor com acesso restrito a super admins
const SystemLog = require('../../models/SystemLog');
const SystemStatus = require('../../models/SystemStatus');
const { pool } = require('../../config/database');

class DeveloperController {
    // Dashboard principal da seção de desenvolvedor
    static async dashboard(req, res) {
        try {
            // Log de acesso à seção de desenvolvedor
            await SystemLog.info('Acesso à seção de desenvolvedor', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            // Verificar status de todos os componentes
            const verificacao = await SystemStatus.verificarTodosComponentes();
            const statusGeral = await SystemStatus.verificarStatusGeral();
            
            // Estatísticas recentes dos logs
            const estatisticasLogs = await SystemLog.obterEstatisticas(7);
            
            // Informações do servidor
            const infoServidor = {
                uptime: process.uptime(),
                memoria: process.memoryUsage(),
                versao_node: process.version,
                plataforma: process.platform,
                pid: process.pid,
                cpu_usage: process.cpuUsage()
            };

            res.json({
                sucesso: true,
                dados: {
                    status_geral: statusGeral,
                    verificacao_componentes: verificacao,
                    estatisticas_logs: estatisticasLogs,
                    info_servidor: infoServidor,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            console.error('Erro no dashboard de desenvolvedor:', error);
            
            await SystemLog.error('Erro no dashboard de desenvolvedor', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { erro: error.message },
                ip_address: req.ip
            });

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Verificar status do sistema em tempo real
    static async verificarStatus(req, res) {
        try {
            const verificacao = await SystemStatus.verificarTodosComponentes();
            const statusGeral = await SystemStatus.verificarStatusGeral();

            res.json({
                sucesso: true,
                dados: {
                    status_geral: statusGeral,
                    verificacao: verificacao,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            console.error('Erro na verificação de status:', error);
            
            await SystemLog.error('Erro na verificação de status', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { erro: error.message }
            });

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao verificar status do sistema'
            });
        }
    }

    // Listar logs do sistema com filtros
    static async listarLogs(req, res) {
        try {
            const {
                level,
                source,
                data_inicio,
                data_fim,
                pagina = 1,
                limite = 50
            } = req.query;

            const offset = (pagina - 1) * limite;

            const filtros = {
                level: level || null,
                source: source || null,
                data_inicio: data_inicio || null,
                data_fim: data_fim || null,
                limite: parseInt(limite),
                offset: parseInt(offset)
            };

            const logs = await SystemLog.listar(filtros);
            const total = await SystemLog.contarTotal(filtros);

            // Log de acesso aos logs (meta!)
            await SystemLog.debug('Consulta aos logs do sistema', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { filtros_aplicados: filtros }
            });

            res.json({
                sucesso: true,
                dados: {
                    logs,
                    paginacao: {
                        pagina_atual: parseInt(pagina),
                        total_paginas: Math.ceil(total / limite),
                        total_registros: total,
                        registros_por_pagina: parseInt(limite)
                    }
                }
            });

        } catch (error) {
            console.error('Erro ao listar logs:', error);
            
            await SystemLog.error('Erro ao listar logs', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { erro: error.message }
            });

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao buscar logs'
            });
        }
    }

    // Estatísticas detalhadas do sistema
    static async estatisticas(req, res) {
        try {
            const { dias = 7 } = req.query;
            
            // Estatísticas dos logs
            const estatisticasLogs = await SystemLog.obterEstatisticas(parseInt(dias));
            
            // Informações detalhadas do banco de dados
            const infoDB = await DeveloperController.obterInfoDatabase();
            
            // Informações do sistema operacional
            const infoSO = {
                plataforma: process.platform,
                arquitetura: process.arch,
                versao_node: process.version,
                memoria_total: process.memoryUsage(),
                uptime_processo: process.uptime(),
                pid: process.pid
            };

            res.json({
                sucesso: true,
                dados: {
                    estatisticas_logs: estatisticasLogs,
                    info_database: infoDB,
                    info_sistema: infoSO,
                    periodo_dias: parseInt(dias),
                    timestamp: new Date()
                }
            });

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            
            await SystemLog.error('Erro ao obter estatísticas', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { erro: error.message }
            });

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao obter estatísticas'
            });
        }
    }

    // Limpar logs antigos
    static async limparLogs(req, res) {
        try {
            const { dias = 30 } = req.body;
            
            const logsRemovidos = await SystemLog.limparLogsAntigos(parseInt(dias));
            
            // Log da operação de limpeza
            await SystemLog.info('Limpeza de logs executada', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { 
                    logs_removidos: logsRemovidos,
                    dias_mantidos: parseInt(dias)
                },
                ip_address: req.ip
            });

            res.json({
                sucesso: true,
                mensagem: `${logsRemovidos} logs antigos foram removidos`,
                dados: {
                    logs_removidos: logsRemovidos,
                    dias_mantidos: parseInt(dias)
                }
            });

        } catch (error) {
            console.error('Erro ao limpar logs:', error);
            
            await SystemLog.error('Erro ao limpar logs', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { erro: error.message }
            });

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao limpar logs'
            });
        }
    }

    // Criar log manual (para testes)
    static async criarLog(req, res) {
        try {
            const { level, message, source = 'manual' } = req.body;
            
            if (!level || !message) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Level e mensagem são obrigatórios'
                });
            }

            const log = await SystemLog.criar({
                level,
                message,
                source,
                admin_id: req.usuario.id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                metadata: {
                    criado_manualmente: true,
                    admin_criador: req.usuario.nome
                }
            });

            res.status(201).json({
                sucesso: true,
                mensagem: 'Log criado com sucesso',
                dados: log
            });

        } catch (error) {
            console.error('Erro ao criar log:', error);
            
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao criar log'
            });
        }
    }

    // Obter informações detalhadas do banco de dados
    static async obterInfoDatabase() {
        try {
            const queries = [
                'SELECT VERSION() as versao',
                'SHOW STATUS LIKE "Uptime"',
                'SHOW STATUS LIKE "Connections"',
                'SHOW STATUS LIKE "Threads_connected"',
                'SHOW STATUS LIKE "Questions"',
                'SELECT table_schema as banco, ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as tamanho_mb FROM information_schema.tables GROUP BY table_schema'
            ];

            const [versao] = await pool.execute(queries[0]);
            const [uptime] = await pool.execute(queries[1]);
            const [connections] = await pool.execute(queries[2]);
            const [threadsConnected] = await pool.execute(queries[3]);
            const [questions] = await pool.execute(queries[4]);
            const [tamanhos] = await pool.execute(queries[5]);

            return {
                versao: versao[0]?.versao || 'N/A',
                uptime_segundos: uptime[0]?.Value || 0,
                total_conexoes: connections[0]?.Value || 0,
                conexoes_ativas: threadsConnected[0]?.Value || 0,
                total_queries: questions[0]?.Value || 0,
                tamanhos_bancos: tamanhos
            };
        } catch (error) {
            console.error('Erro ao obter info do database:', error);
            return {
                erro: error.message
            };
        }
    }

    // Forçar verificação de todos os componentes
    static async forcarVerificacao(req, res) {
        try {
            await SystemLog.info('Verificação manual iniciada', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                ip_address: req.ip
            });

            const resultado = await SystemStatus.verificarTodosComponentes();
            const statusGeral = await SystemStatus.verificarStatusGeral();

            await SystemLog.info('Verificação manual concluída', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { resultado }
            });

            res.json({
                sucesso: true,
                mensagem: 'Verificação concluída',
                dados: {
                    status_geral: statusGeral,
                    resultado_verificacao: resultado,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            console.error('Erro na verificação forçada:', error);
            
            await SystemLog.error('Erro na verificação manual', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { erro: error.message }
            });

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao executar verificação'
            });
        }
    }

    // Obter informações técnicas detalhadas
    static async obterInformacoesTecnicas(req, res) {
        try {
            const informacoes = {
                servidor: {
                    node_version: process.version,
                    plataforma: process.platform,
                    pid: process.pid,
                    uptime: process.uptime(),
                    memoria: process.memoryUsage()
                },
                banco_dados: {
                    versao: 'Carregando...',
                    conexoes_ativas: 'Carregando...',
                    uptime: 'Carregando...',
                    charset: 'Carregando...'
                }
            };

            try {
                // Buscar informações do MySQL
                const [versaoResult] = await pool.execute('SELECT VERSION() as version');
                const [statusResult] = await pool.execute(`
                    SHOW STATUS WHERE Variable_name IN (
                        'Threads_connected', 
                        'Uptime',
                        'character_set_database'
                    )
                `);
                
                // Processar resultados do status
                const statusMap = {};
                statusResult.forEach(row => {
                    statusMap[row.Variable_name] = row.Value;
                });

                // Formatar uptime do banco
                const uptimeSeconds = parseInt(statusMap.Uptime || 0);
                const days = Math.floor(uptimeSeconds / 86400);
                const hours = Math.floor((uptimeSeconds % 86400) / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;

                informacoes.banco_dados = {
                    versao: versaoResult[0].version || 'N/A',
                    conexoes_ativas: statusMap.Threads_connected || '0',
                    uptime: uptimeFormatted,
                    charset: 'UTF-8'
                };

            } catch (dbError) {
                console.error('Erro ao buscar informações do banco:', dbError);
                informacoes.banco_dados = {
                    versao: 'Erro ao conectar',
                    conexoes_ativas: 'N/A',
                    uptime: 'N/A',
                    charset: 'N/A'
                };
            }

            res.json({
                sucesso: true,
                dados: informacoes
            });

        } catch (error) {
            console.error('Erro ao obter informações técnicas:', error);
            
            await SystemLog.error('Erro ao obter informações técnicas', {
                source: 'developer_section',
                admin_id: req.usuario.id,
                metadata: { erro: error.message }
            });

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao obter informações técnicas'
            });
        }
    }
}

module.exports = DeveloperController;