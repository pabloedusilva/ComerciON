// Status da loja (aberto/fechado)
const StoreStatus = require('../../models/StoreStatus');
const StoreHours = require('../../models/StoreHours');
const { computeEffectiveClosed, getNextBoundary } = require('../../utils/storeStatus');

const PublicStoreController = {
  // GET /api/public/store
  async getStoreStatus(req, res) {
    try {
  const status = await StoreStatus.get();
  const hours = await StoreHours.getAll();
  const effectiveClosed = computeEffectiveClosed(status, hours);
  const nextBoundary = getNextBoundary(status, hours, new Date());
  const reopenAtComputed = effectiveClosed ? (nextBoundary ? nextBoundary.toISOString() : status.reopen_at) : null;
      
      res.json({
        sucesso: true,
        data: {
          closedNow: status.closed_now,
          effectiveClosed,
          reopenAt: reopenAtComputed,
          reason: status.reason,
          isManualMode: status.is_manual_mode,
          nextChangeAt: nextBoundary ? nextBoundary.toISOString() : null,
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