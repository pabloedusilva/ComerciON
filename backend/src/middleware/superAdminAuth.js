// Middleware de segurança extrema para seção de desenvolvedor
const { verificarToken } = require('./auth');
const SystemLog = require('../models/SystemLog');
const crypto = require('crypto');

// Middleware para verificar super admin com segurança extra
const verificarSuperAdmin = async (req, res, next) => {
    try {
        // Verificar token básico primeiro
        await verificarToken(req, res, async () => {
            // Verificações de super admin
            if (req.tipoUsuario !== 'admin') {
                await SystemLog.warn('Tentativa de acesso negada - não é admin', {
                    source: 'security',
                    admin_id: req.usuario?.id,
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent'),
                    metadata: { 
                        motivo: 'nao_admin',
                        url: req.originalUrl 
                    }
                });

                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Acesso negado'
                });
            }

            // Verificar nível de super admin
            if (!req.usuario.super_admin || req.usuario.nivel_acesso !== 'super_admin') {
                await SystemLog.warn('Tentativa de acesso negada - não é super admin', {
                    source: 'security',
                    admin_id: req.usuario.id,
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent'),
                    metadata: { 
                        motivo: 'nao_super_admin',
                        nivel_atual: req.usuario.nivel_acesso,
                        super_admin_flag: req.usuario.super_admin,
                        url: req.originalUrl 
                    }
                });

                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Acesso negado - privilégios insuficientes'
                });
            }

            // Verificações adicionais de segurança
            const verificacoesSeguanca = await executarVerificacoesSeguanca(req);
            
            if (!verificacoesSeguanca.sucesso) {
                await SystemLog.error('Falha nas verificações de segurança', {
                    source: 'security',
                    admin_id: req.usuario.id,
                    ip_address: req.ip,
                    metadata: { 
                        motivo: verificacoesSeguanca.motivo,
                        detalhes: verificacoesSeguanca.detalhes
                    }
                });

                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Acesso negado por motivos de segurança'
                });
            }

            // Log de acesso autorizado
            await SystemLog.info('Acesso autorizado à seção de desenvolvedor', {
                source: 'security',
                admin_id: req.usuario.id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                metadata: {
                    url: req.originalUrl,
                    metodo: req.method,
                    verificacoes_seguranca: verificacoesSeguanca.verificacoes
                }
            });

            next();
        });
    } catch (error) {
        console.error('Erro na verificação de super admin:', error);
        
        await SystemLog.error('Erro no middleware de segurança', {
            source: 'security',
            admin_id: req.usuario?.id,
            ip_address: req.ip,
            metadata: { erro: error.message }
        });

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno de segurança'
        });
    }
};

// Executar verificações adicionais de segurança
async function executarVerificacoesSeguanca(req) {
    const verificacoes = {
        ip_check: false,
        user_agent_check: false,
        session_validity: false,
        rate_limit_check: false,
        time_based_check: false
    };

    try {
        // 1. Verificação de IP (opcional - pode ser configurada para IPs específicos)
        verificacoes.ip_check = verificarIP(req.ip);

        // 2. Verificação de User-Agent (detectar bots/scripts suspeitos)
        verificacoes.user_agent_check = verificarUserAgent(req.get('User-Agent'));

        // 3. Verificar validade da sessão no banco
        verificacoes.session_validity = await verificarValidadeSessao(req);

        // 4. Verificação de rate limit específico para super admin
        verificacoes.rate_limit_check = await verificarRateLimitSuperAdmin(req);

        // 5. Verificação baseada em tempo (horário comercial, etc.)
        verificacoes.time_based_check = verificarHorario();

        const todasVerificacoes = Object.values(verificacoes).every(v => v === true);

        return {
            sucesso: todasVerificacoes,
            verificacoes,
            motivo: todasVerificacoes ? null : 'Uma ou mais verificações de segurança falharam',
            detalhes: verificacoes
        };

    } catch (error) {
        return {
            sucesso: false,
            verificacoes,
            motivo: 'Erro durante verificações de segurança',
            detalhes: error.message
        };
    }
}

// Verificar IP (permite todos por padrão, mas pode ser restrito)
function verificarIP(ip) {
    // TODO: Implementar lista de IPs permitidos se necessário
    // const ipsPermitidos = ['127.0.0.1', '::1', 'seu_ip_aqui'];
    // return ipsPermitidos.includes(ip);
    
    // Por enquanto, aceita todos os IPs
    return true;
}

// Verificar User-Agent para detectar bots suspeitos
function verificarUserAgent(userAgent) {
    if (!userAgent || userAgent.length < 10) {
        return false;
    }

    // Lista de user agents suspeitos
    const userAgentsSuspeitos = [
        'bot',
        'crawler',
        'spider',
        'scraper',
        'curl',
        'wget',
        'postman' // Opcional: bloquear ferramentas de API
    ];

    const userAgentLower = userAgent.toLowerCase();
    const ehSuspeito = userAgentsSuspeitos.some(suspeito => 
        userAgentLower.includes(suspeito)
    );

    return !ehSuspeito;
}

// Verificar validade da sessão no banco de dados
async function verificarValidadeSessao(req) {
    try {
        const { pool } = require('../config/database');
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) return false;

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const query = `
            SELECT id, admin_id, expira_em, ativo 
            FROM sessoes 
            WHERE token_hash = ? AND admin_id = ? AND tipo_usuario = 'admin'
        `;
        
        const [rows] = await pool.execute(query, [tokenHash, req.usuario.id]);
        
        if (rows.length === 0) return false;

        const sessao = rows[0];
        
        // Verificar se a sessão está ativa e não expirou
        return sessao.ativo === 1 && new Date(sessao.expira_em) > new Date();

    } catch (error) {
        console.error('Erro na verificação de sessão:', error);
        return false;
    }
}

// Rate limit específico para super admin (mais restritivo)
const rateLimitCache = new Map();

async function verificarRateLimitSuperAdmin(req) {
    const key = `super_admin_${req.usuario.id}_${req.ip}`;
    const agora = Date.now();
    const janela = 60 * 1000; // 1 minuto
    const limite = 30; // 30 requests por minuto

    const dadosCache = rateLimitCache.get(key) || { contador: 0, inicioJanela: agora };

    // Reset do contador se a janela expirou
    if (agora - dadosCache.inicioJanela > janela) {
        dadosCache.contador = 0;
        dadosCache.inicioJanela = agora;
    }

    dadosCache.contador++;
    rateLimitCache.set(key, dadosCache);

    // Limpar cache antigo periodicamente
    if (rateLimitCache.size > 1000) {
        const chaves = Array.from(rateLimitCache.keys());
        chaves.slice(0, 500).forEach(chave => rateLimitCache.delete(chave));
    }

    return dadosCache.contador <= limite;
}

// Verificação baseada em horário (opcional)
function verificarHorario() {
    // TODO: Implementar restrições de horário se necessário
    // const agora = new Date();
    // const hora = agora.getHours();
    // return hora >= 8 && hora <= 22; // Apenas entre 8h e 22h
    
    // Por enquanto, aceita qualquer horário
    return true;
}

// Middleware para logs detalhados de auditoria
const logAuditoria = async (req, res, next) => {
    const inicio = Date.now();
    
    // Log da requisição
    await SystemLog.info('Requisição à seção de desenvolvedor', {
        source: 'audit',
        admin_id: req.usuario?.id,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        metadata: {
            metodo: req.method,
            url: req.originalUrl,
            query: req.query,
            timestamp: new Date(),
            referer: req.get('Referer')
        }
    });

    // Interceptar resposta para log do resultado
    const originalSend = res.send;
    res.send = function(data) {
        const fim = Date.now();
        const duracao = fim - inicio;

        // Log da resposta (sem dados sensíveis)
        SystemLog.info('Resposta da seção de desenvolvedor', {
            source: 'audit',
            admin_id: req.usuario?.id,
            ip_address: req.ip,
            metadata: {
                metodo: req.method,
                url: req.originalUrl,
                status_code: res.statusCode,
                duracao_ms: duracao,
                tamanho_resposta: Buffer.byteLength(data, 'utf8'),
                timestamp: new Date()
            }
        }).catch(err => console.error('Erro no log de auditoria:', err));

        originalSend.call(this, data);
    };

    next();
};

module.exports = {
    verificarSuperAdmin,
    logAuditoria,
    executarVerificacoesSeguanca
};