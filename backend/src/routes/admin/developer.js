// Rotas da Seção de Desenvolvedor - Acesso extremamente restrito
const express = require('express');
const router = express.Router();
const DeveloperController = require('../../controllers/admin/developerController');
const { verificarSuperAdmin, logAuditoria } = require('../../middleware/superAdminAuth');
const { limiteDeveloper } = require('../../middleware/rateLimit');

// Aplicar middleware de segurança e auditoria em todas as rotas
router.use(verificarSuperAdmin);
router.use(logAuditoria);
router.use(limiteDeveloper);

// GET /api/admin/developer/dashboard - Dashboard principal
router.get('/dashboard', DeveloperController.dashboard);

// GET /api/admin/developer/status - Verificar status do sistema
router.get('/status', DeveloperController.verificarStatus);

// POST /api/admin/developer/status/verificar - Forçar verificação completa
router.post('/status/verificar', DeveloperController.forcarVerificacao);

// GET /api/admin/developer/logs - Listar logs do sistema
router.get('/logs', DeveloperController.listarLogs);

// POST /api/admin/developer/logs - Criar log manual (para testes)
router.post('/logs', DeveloperController.criarLog);

// DELETE /api/admin/developer/logs/limpar - Limpar logs antigos
router.delete('/logs/limpar', DeveloperController.limparLogs);

// GET /api/admin/developer/estatisticas - Estatísticas detalhadas
router.get('/estatisticas', DeveloperController.estatisticas);

// GET /api/admin/developer/tech-info - Informações técnicas detalhadas
router.get('/tech-info', DeveloperController.obterInformacoesTecnicas);

module.exports = router;