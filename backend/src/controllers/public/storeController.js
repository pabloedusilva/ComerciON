// Status da loja (aberto/fechado)
const StoreStatus = require('../../models/StoreStatus');
const StoreHours = require('../../models/StoreHours');

const PublicStoreController = {
  // GET /api/public/store
  async getStoreStatus(req, res) {
    try {
      const status = await StoreStatus.get();
      const hours = await StoreHours.getAll();
      
      res.json({
        sucesso: true,
        data: {
          closedNow: status.closed_now,
          reopenAt: status.reopen_at,
          reason: status.reason,
          isManualMode: status.is_manual_mode,
          hours: hours.map(h => ({
            day: h.day,
            enabled: h.enabled,
            open: h.open,
            close: h.close
          }))
        }
      });
    } catch (error) {
      console.error('Erro ao buscar status público da loja:', error);
      res.status(500).json({
        sucesso: false,
        mensagem: 'Erro interno do servidor'
      });
    }
  }
};

module.exports = PublicStoreController;