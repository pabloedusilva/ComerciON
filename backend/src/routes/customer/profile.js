// Rotas de Perfil do Cliente - Extremamente protegidas
const express = require('express');
const router = express.Router();
const { autenticarCliente } = require('../../middleware/auth');
const { sanitizarEntrada, verificarValidacao } = require('../../middleware/validation');
const ProfileController = require('../../controllers/customer/profileController');
const rateLimit = require('express-rate-limit');

// Rate limit dedicado para alterações de perfil (aumenta segurança)
const limitePerfil = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: process.env.NODE_ENV === 'production' ? 20 : 200,
	standardHeaders: true,
	legacyHeaders: false
});

// Sanitização global
router.use(sanitizarEntrada);
router.use(autenticarCliente);
router.use(limitePerfil);

// GET /api/customer/profile - obter dados do perfil
router.get('/', ProfileController.obterPerfil);

// PUT /api/customer/profile - atualizar dados básicos (nome, telefone, endereço, cidade, estado, cep)
router.put('/', ProfileController.atualizarPerfil);

// PUT /api/customer/profile/email - alterar email (com revalidação de senha)
router.put('/email', ProfileController.alterarEmail);

// PUT /api/customer/profile/senha - alterar senha (com verificação da senha atual)
router.put('/senha', ProfileController.alterarSenha);

module.exports = router;