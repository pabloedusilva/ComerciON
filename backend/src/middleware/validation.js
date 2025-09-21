// Validação de dados
const { body, validationResult } = require('express-validator');

// Middleware para verificar erros de validação
const verificarValidacao = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Dados inválidos',
            erros: errors.array()
        });
    }
    next();
};

// Validações para cadastro de usuário
const validarCadastroUsuario = [
    body('nome')
        .isLength({ min: 2, max: 100 })
        .withMessage('Nome deve ter entre 2 e 100 caracteres')
        .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
        .withMessage('Nome deve conter apenas letras e espaços'),
    
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail()
        .isLength({ max: 100 })
        .withMessage('Email muito longo'),
    
    body('senha')
        .isLength({ min: 6, max: 50 })
        .withMessage('Senha deve ter entre 6 e 50 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Senha deve conter pelo menos: 1 minúscula, 1 maiúscula e 1 número'),
    
    body('telefone')
        .optional()
        .matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/)
        .withMessage('Telefone deve estar no formato (XX) XXXXX-XXXX'),
    
    body('cep')
        .optional()
        .matches(/^\d{5}-?\d{3}$/)
        .withMessage('CEP deve estar no formato XXXXX-XXX'),
        
    verificarValidacao
];

// Validações para login
const validarLogin = [
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail(),
    
    body('senha')
        .notEmpty()
        .withMessage('Senha é obrigatória'),
        
    verificarValidacao
];

// Validações para cadastro de admin
const validarCadastroAdmin = [
    body('nome')
        .isLength({ min: 2, max: 100 })
        .withMessage('Nome deve ter entre 2 e 100 caracteres')
        .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
        .withMessage('Nome deve conter apenas letras e espaços'),
    
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail()
        .isLength({ max: 100 })
        .withMessage('Email muito longo'),
    
    body('senha')
        .isLength({ min: 8, max: 50 })
        .withMessage('Senha deve ter entre 8 e 50 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
        .withMessage('Senha deve conter: 1 minúscula, 1 maiúscula, 1 número e 1 símbolo'),
    
    body('nivel_acesso')
        .optional()
        .isIn(['admin', 'super_admin'])
        .withMessage('Nível de acesso inválido'),
        
    verificarValidacao
];

// Validações para alteração de senha
const validarAlteracaoSenha = [
    body('senhaAtual')
        .notEmpty()
        .withMessage('Senha atual é obrigatória'),
    
    body('novaSenha')
        .isLength({ min: 6, max: 50 })
        .withMessage('Nova senha deve ter entre 6 e 50 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Nova senha deve conter pelo menos: 1 minúscula, 1 maiúscula e 1 número'),
    
    body('confirmarSenha')
        .custom((value, { req }) => {
            if (value !== req.body.novaSenha) {
                throw new Error('Confirmação de senha não confere');
            }
            return true;
        }),
        
    verificarValidacao
];

// Sanitização de dados de entrada
const sanitizarEntrada = (req, res, next) => {
    // Remove caracteres perigosos
    const sanitizar = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove scripts e tags HTML
                obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                obj[key] = obj[key].replace(/<[^>]*>/g, '');
                // Trim espaços
                obj[key] = obj[key].trim();
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizar(obj[key]);
            }
        }
    };

    if (req.body) sanitizar(req.body);
    if (req.query) sanitizar(req.query);
    if (req.params) sanitizar(req.params);

    next();
};

module.exports = {
    validarCadastroUsuario,
    validarLogin,
    validarCadastroAdmin,
    validarAlteracaoSenha,
    sanitizarEntrada,
    verificarValidacao
};