// Rate limiting para segurança
const rateLimit = require('express-rate-limit');
const { rateLimitWindow, rateLimitMax } = require('../config/environment');

// Rate limit geral - muito mais permissivo em desenvolvimento
const limiteGeral = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? rateLimitWindow : 30 * 1000, // 30 seg em dev, 15 min em prod
    max: process.env.NODE_ENV === 'production' ? rateLimitMax : 5000, // 5000 em dev, 100 em prod
    message: {
        sucesso: false,
        mensagem: 'Muitas tentativas. Tente novamente em alguns minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limit para login - muito mais permissivo em desenvolvimento
const limiteLogin = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 1 * 60 * 1000, // 1 min em dev, 15 min em prod
    max: process.env.NODE_ENV === 'production' ? 5 : 200, // 200 tentativas em dev, 5 em prod
    message: {
        sucesso: false,
        mensagem: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Não conta tentativas bem-sucedidas
});

// Rate limit específico para admin - muito mais permissivo em desenvolvimento
const limiteAdmin = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 1 * 60 * 1000, // 1 min em dev, 15 min em prod
    max: process.env.NODE_ENV === 'production' ? 3 : 100, // 100 tentativas em dev, 3 em prod
    message: {
        sucesso: false,
        mensagem: 'Muitas tentativas de acesso admin. Tente novamente em alguns minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

// Rate limit para cadastro - muito mais permissivo em desenvolvimento
const limiteCadastro = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 60 * 60 * 1000 : 5 * 60 * 1000, // 5 min em dev, 1 hora em prod
    max: process.env.NODE_ENV === 'production' ? 3 : 100, // 100 cadastros em dev, 3 em prod
    message: {
        sucesso: false,
        mensagem: 'Muitos cadastros realizados. Tente novamente mais tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limit específico para seção de desenvolvedor - muito restritivo
const limiteDeveloper = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: process.env.NODE_ENV === 'production' ? 20 : 100, // 100 em dev, 20 em prod
    message: {
        sucesso: false,
        mensagem: 'Rate limit excedido para seção de desenvolvedor. Aguarde 1 minuto.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Chave específica incluindo ID do admin para maior controle
        return `developer_${req.usuario?.id}_${req.ip}`;
    }
});

module.exports = {
    limiteGeral,
    limiteLogin,
    limiteAdmin,
    limiteCadastro,
    limiteDeveloper
};