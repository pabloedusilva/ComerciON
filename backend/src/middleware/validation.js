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

// ===== Produtos =====
const isBase64Image = (val) => typeof val === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(val);
const estimateBase64SizeBytes = (b64) => {
    // tamanho aproximado: 3/4 do comprimento removendo cabeçalho
    const content = b64.split(',')[1] || '';
    return Math.floor((content.length * 3) / 4);
};

const validarProdutoBase = [
    body('name').isString().isLength({ min: 2, max: 255 }).withMessage('Nome inválido'),
    // Aceitar slug de categoria dinâmico (a-z0-9-_) e 'drink' como padrão
    body('category').isString().matches(/^[a-z0-9_-]{3,50}$/).withMessage('Categoria inválida'),
    body('description').optional().isString().isLength({ max: 5000 }).withMessage('Descrição muito longa'),
    body('price').isArray({ min: 1, max: 3 }).withMessage('Preço deve ser array de até 3 itens'),
    body('price.*').isFloat({ min: 0, max: 9999 }).withMessage('Preço inválido'),
    body('price').custom((arr) => {
        try {
            if (!Array.isArray(arr)) return false;
            const nums = arr.map(v => Number(v) || 0);
            if (!nums.some(v => v > 0)) throw new Error('Pelo menos um preço deve ser maior que zero');
            return true;
        } catch (e) {
            throw new Error(e.message || 'Preço inválido');
        }
    }),
    body('status').optional().isIn(['active','inactive']).withMessage('Status inválido')
];

const validarProdutoImagem = [
    body('img').custom((val) => {
        if (val == null || val === '') return true; // sem imagem é permitido
        if (!isBase64Image(val)) return true; // se for URL string normal, também permitimos
        const size = estimateBase64SizeBytes(val);
        const max = 3 * 1024 * 1024; // 3MB
        if (size > max) throw new Error('Imagem muito grande (máx 3MB)');
        return true;
    })
];

const validarProdutoCreate = [
    ...validarProdutoBase,
    ...validarProdutoImagem,
    verificarValidacao
];

const validarProdutoUpdate = [
    ...validarProdutoBase,
    ...validarProdutoImagem,
    verificarValidacao
];

module.exports.validarProdutoCreate = validarProdutoCreate;
module.exports.validarProdutoUpdate = validarProdutoUpdate;