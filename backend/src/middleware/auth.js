// Middleware de Autenticação JWT
const jwt = require('jsonwebtoken');
const { jwtSecret, strictSessionUA, strictSessionIP } = require('../config/environment');
const { pool } = require('../config/database');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Verificar token JWT
const verificarToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token de acesso requerido'
            });
        }

        // Verificar se token é válido
        const decoded = jwt.verify(token, jwtSecret);
        
        // Verificar se sessão existe no banco (segurança extra)
        const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
        const query = `
            SELECT * FROM sessoes 
            WHERE token_hash = ? AND expira_em > NOW() AND ativo = TRUE
        `;
        const [sessoes] = await pool.execute(query, [tokenHash]);
        
        if (sessoes.length === 0) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Sessão inválida ou expirada'
            });
        }

        const sessao = sessoes[0];

        // Fingerprint: validar user agent e opcionalmente IP
        if (strictSessionUA) {
            const ua = (req.get('User-Agent') || '').slice(0, 300);
            if (ua && sessao.user_agent && ua !== sessao.user_agent) {
                return res.status(401).json({ sucesso: false, mensagem: 'Sessão inválida (fingerprint-UA)' });
            }
        }
        if (strictSessionIP) {
            const ip = req.ip;
            if (ip && sessao.ip_address && ip !== sessao.ip_address) {
                return res.status(401).json({ sucesso: false, mensagem: 'Sessão inválida (fingerprint-IP)' });
            }
        }
        
        // Buscar usuário baseado no tipo
        let usuario;
        if (sessao.tipo_usuario === 'cliente' || sessao.tipo_usuario === 'customer') {
            usuario = await User.buscarPorId(sessao.user_id || sessao.usuario_id);
        } else if (sessao.tipo_usuario === 'admin') {
            usuario = await Admin.buscarPorId(sessao.admin_id);
        }

        if (!usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado'
            });
        }

        // Adicionar dados do usuário na requisição
        req.usuario = usuario;
        req.tipoUsuario = sessao.tipo_usuario;
        req.sessaoId = sessao.id;
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token inválido'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token expirado'
            });
        }

        console.error('Erro na autenticação:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno do servidor'
        });
    }
};

// Middleware específico para clientes
const autenticarCliente = async (req, res, next) => {
    await verificarToken(req, res, () => {
        if (!(req.tipoUsuario === 'cliente' || req.tipoUsuario === 'customer')) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado - apenas clientes'
            });
        }
        next();
    });
};

// Middleware específico para admins
const autenticarAdmin = async (req, res, next) => {
    await verificarToken(req, res, () => {
        if (req.tipoUsuario !== 'admin') {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado - apenas admins'
            });
        }
        next();
    });
};

// Middleware para super admin
const autenticarSuperAdmin = async (req, res, next) => {
    await verificarToken(req, res, () => {
        if (req.tipoUsuario !== 'admin' || req.usuario.nivel_acesso !== 'super_admin') {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado - apenas super admins'
            });
        }
        next();
    });
};

// Logout - invalidar sessão
const logout = async (req, res, next) => {
    try {
        if (req.sessaoId) {
            const query = 'DELETE FROM sessoes WHERE id = ?';
            await pool.execute(query, [req.sessaoId]);
        }
        next();
    } catch (error) {
        console.error('Erro no logout:', error);
        // Continua mesmo com erro para não travar o logout
        next();
    }
};

module.exports = {
    verificarToken,
    autenticarCliente,
    autenticarAdmin,
    autenticarSuperAdmin,
    logout
};