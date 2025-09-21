// Rotas de Autenticação - Clientes
const express = require('express');
const router = express.Router();
const AuthController = require('../../controllers/customer/authController');
const { autenticarCliente, logout } = require('../../middleware/auth');
const { limiteLogin, limiteCadastro } = require('../../middleware/rateLimit');
const { 
    validarCadastroUsuario, 
    validarLogin, 
    validarAlteracaoSenha,
    sanitizarEntrada 
} = require('../../middleware/validation');

// Aplicar sanitização em todas as rotas
router.use(sanitizarEntrada);

// POST /api/customer/auth/registrar - Cadastro de cliente
router.post('/registrar', 
    limiteCadastro,
    validarCadastroUsuario,
    AuthController.registrar
);

// POST /api/customer/auth/login - Login de cliente
router.post('/login',
    limiteLogin,
    validarLogin,
    AuthController.login
);

// POST /api/customer/auth/logout - Logout de cliente
router.post('/logout',
    autenticarCliente,
    logout,
    AuthController.logout
);

// GET /api/customer/auth/verificar - Verificar token
router.get('/verificar',
    autenticarCliente,
    AuthController.verificarToken
);

// PUT /api/customer/auth/perfil - Atualizar perfil
router.put('/perfil',
    autenticarCliente,
    AuthController.atualizarPerfil
);

// PUT /api/customer/auth/senha - Alterar senha
router.put('/senha',
    autenticarCliente,
    validarAlteracaoSenha,
    AuthController.alterarSenha
);

module.exports = router;