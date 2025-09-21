// Rotas de Autenticação - Admin
const express = require('express');
const router = express.Router();
const AdminAuthController = require('../../controllers/admin/authController');
const { autenticarAdmin, autenticarSuperAdmin } = require('../../middleware/auth');
const { limiteAdmin } = require('../../middleware/rateLimit');
const { 
    validarLogin, 
    validarCadastroAdmin,
    validarAlteracaoSenha,
    sanitizarEntrada 
} = require('../../middleware/validation');

// Aplicar sanitização em todas as rotas
router.use(sanitizarEntrada);

// POST /api/admin/auth/login - Login de admin
router.post('/login',
    limiteAdmin,
    validarLogin,
    AdminAuthController.login
);

// POST /api/admin/auth/logout - Logout de admin
router.post('/logout',
    autenticarAdmin,
    AdminAuthController.logout
);

// GET /api/admin/auth/verificar - Verificar token admin
router.get('/verificar',
    autenticarAdmin,
    AdminAuthController.verificarToken
);

// POST /api/admin/auth/criar - Criar novo admin (apenas super_admin)
router.post('/criar',
    autenticarSuperAdmin,
    validarCadastroAdmin,
    AdminAuthController.criarAdmin
);

// PUT /api/admin/auth/senha - Alterar senha admin
router.put('/senha',
    autenticarAdmin,
    validarAlteracaoSenha,
    AdminAuthController.alterarSenha
);

// GET /api/admin/auth/listar - Listar admins (apenas super_admin)
router.get('/listar',
    autenticarSuperAdmin,
    AdminAuthController.listarAdmins
);

// DELETE /api/admin/auth/desativar/:adminId - Desativar admin (apenas super_admin)
router.delete('/desativar/:adminId',
    autenticarSuperAdmin,
    AdminAuthController.desativarAdmin
);

module.exports = router;