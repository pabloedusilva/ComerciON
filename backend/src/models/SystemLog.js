// Model SystemLog - Logs do sistema para monitoramento
const { pool } = require('../config/database');

class SystemLog {
    constructor(data) {
        this.id = data.id;
        this.level = data.level;
        this.message = data.message;
        this.metadata = data.metadata;
        this.source = data.source;
        this.admin_id = data.admin_id;
        this.ip_address = data.ip_address;
        this.user_agent = data.user_agent;
        this.created_at = data.created_at;
    }

    // Criar novo log
    static async criar(dados) {
        try {
            const { 
                level = 'info', 
                message, 
                metadata = null, 
                source = null, 
                admin_id = null, 
                ip_address = null, 
                user_agent = null 
            } = dados;

            const query = `
                INSERT INTO system_logs (level, message, metadata, source, admin_id, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            let metadataJson = null;
            if (metadata) {
                try {
                    // Se já é string, usar diretamente (assumindo que é JSON válido)
                    if (typeof metadata === 'string') {
                        // Tentar validar se é JSON válido
                        JSON.parse(metadata);
                        metadataJson = metadata;
                    } else {
                        // Se é objeto, serializar
                        metadataJson = JSON.stringify(metadata);
                    }
                } catch (jsonError) {
                    console.warn('Erro ao serializar metadata, salvando como string:', jsonError.message);
                    metadataJson = JSON.stringify({ 
                        erro_serialization: true, 
                        valor_original: String(metadata),
                        erro: jsonError.message 
                    });
                }
            }
            
            const [resultado] = await pool.execute(query, [
                level, message, metadataJson, source, admin_id, ip_address, user_agent
            ]);

            return await SystemLog.buscarPorId(resultado.insertId);
        } catch (error) {
            console.error('Erro ao criar log:', error);
            throw new Error(`Erro ao criar log: ${error.message}`);
        }
    }

    // Buscar por ID
    static async buscarPorId(id) {
        try {
            const query = 'SELECT * FROM system_logs WHERE id = ?';
            const [rows] = await pool.execute(query, [id]);
            
            if (rows.length === 0) return null;
            
            const log = rows[0];
            if (log.metadata) {
                try {
                    // Tentar fazer parse apenas se for string e não estiver vazio
                    if (typeof log.metadata === 'string' && log.metadata.trim()) {
                        log.metadata = JSON.parse(log.metadata);
                    } else if (typeof log.metadata === 'object') {
                        // Se já é objeto, manter como está
                        log.metadata = log.metadata;
                    } else {
                        // Se for null, undefined ou string vazia
                        log.metadata = null;
                    }
                } catch (jsonError) {
                    console.warn(`JSON inválido no log ${id}:`, log.metadata, jsonError.message);
                    log.metadata = { 
                        erro_parse: true, 
                        valor_original: log.metadata,
                        erro: jsonError.message 
                    };
                }
            }
            
            return new SystemLog(log);
        } catch (error) {
            console.error('Erro ao buscar log por ID:', error);
            throw new Error(`Erro ao buscar log: ${error.message}`);
        }
    }

    // Listar logs com filtros e paginação
    static async listar(filtros = {}) {
        try {
            const { 
                level = null, 
                source = null, 
                admin_id = null,
                data_inicio = null,
                data_fim = null,
                limite = 100, 
                offset = 0 
            } = filtros;

            // Garantir que limite e offset sejam números
            const limiteNumerico = parseInt(limite) || 100;
            const offsetNumerico = parseInt(offset) || 0;

            let query = `
                SELECT sl.*, a.nome as admin_nome, a.email as admin_email
                FROM system_logs sl
                LEFT JOIN admins a ON sl.admin_id = a.id
                WHERE 1=1
            `;
            
            const params = [];

            if (level) {
                query += ' AND sl.level = ?';
                params.push(level);
            }

            if (source) {
                query += ' AND sl.source = ?';
                params.push(source);
            }

            if (admin_id) {
                query += ' AND sl.admin_id = ?';
                params.push(admin_id);
            }

            if (data_inicio) {
                query += ' AND sl.created_at >= ?';
                params.push(data_inicio);
            }

            if (data_fim) {
                query += ' AND sl.created_at <= ?';
                params.push(data_fim);
            }

            // Usar concatenação para LIMIT (seguro pois são números validados)
            query += ` ORDER BY sl.created_at DESC LIMIT ${limiteNumerico} OFFSET ${offsetNumerico}`;

            const [rows] = await pool.execute(query, params);
            
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
                        console.warn(`JSON inválido no log ${row.id}:`, row.metadata, jsonError.message);
                        row.metadata = { 
                            erro_parse: true, 
                            valor_original: row.metadata,
                            erro: jsonError.message 
                        };
                    }
                }
                return row;
            });
        } catch (error) {
            throw new Error(`Erro ao listar logs: ${error.message}`);
        }
    }

    // Contar total de logs com filtros
    static async contarTotal(filtros = {}) {
        try {
            const { 
                level = null, 
                source = null, 
                admin_id = null,
                data_inicio = null,
                data_fim = null
            } = filtros;

            let query = 'SELECT COUNT(*) as total FROM system_logs WHERE 1=1';
            const params = [];

            if (level) {
                query += ' AND level = ?';
                params.push(level);
            }

            if (source) {
                query += ' AND source = ?';
                params.push(source);
            }

            if (admin_id) {
                query += ' AND admin_id = ?';
                params.push(admin_id);
            }

            if (data_inicio) {
                query += ' AND created_at >= ?';
                params.push(data_inicio);
            }

            if (data_fim) {
                query += ' AND created_at <= ?';
                params.push(data_fim);
            }

            const [rows] = await pool.execute(query, params);
            return rows[0].total;
        } catch (error) {
            throw new Error(`Erro ao contar logs: ${error.message}`);
        }
    }

    // Limpar logs antigos (mantém apenas logs dos últimos X dias)
    static async limparLogsAntigos(diasParaManter = 30) {
        try {
            const query = 'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)';
            const [resultado] = await pool.execute(query, [diasParaManter]);
            
            return resultado.affectedRows;
        } catch (error) {
            throw new Error(`Erro ao limpar logs antigos: ${error.message}`);
        }
    }

    // Obter estatísticas dos logs
    static async obterEstatisticas(diasAtras = 7) {
        try {
            const query = `
                SELECT 
                    level,
                    COUNT(*) as total,
                    DATE(created_at) as data
                FROM system_logs 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY level, DATE(created_at)
                ORDER BY data DESC, level
            `;
            
            const [rows] = await pool.execute(query, [diasAtras]);
            return rows;
        } catch (error) {
            throw new Error(`Erro ao obter estatísticas: ${error.message}`);
        }
    }

    // Helper para logging rápido
    static async log(level, message, dados = {}) {
        return await SystemLog.criar({
            level,
            message,
            metadata: dados.metadata || null,
            source: dados.source || 'system',
            admin_id: dados.admin_id || null,
            ip_address: dados.ip_address || null,
            user_agent: dados.user_agent || null
        });
    }

    // Helpers específicos para cada nível
    static async debug(message, dados = {}) {
        return await SystemLog.log('debug', message, dados);
    }

    static async info(message, dados = {}) {
        return await SystemLog.log('info', message, dados);
    }

    static async warn(message, dados = {}) {
        return await SystemLog.log('warn', message, dados);
    }

    static async error(message, dados = {}) {
        return await SystemLog.log('error', message, dados);
    }

    static async fatal(message, dados = {}) {
        return await SystemLog.log('fatal', message, dados);
    }
}

module.exports = SystemLog;