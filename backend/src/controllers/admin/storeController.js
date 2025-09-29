// Controller para Store Status e Hours
const StoreStatus = require('../../models/StoreStatus');
const StoreHours = require('../../models/StoreHours');

const StoreController = {
  // GET /api/admin/store/status
  async getStatus(req, res) {
    try {
      const status = await StoreStatus.get();
      const hours = await StoreHours.getAll();
      
      res.json({
        sucesso: true,
        data: {
          status,
          hours
        }
      });
    } catch (error) {
      console.error('Erro ao buscar status da loja:', error);
      res.status(500).json({
        sucesso: false,
        mensagem: 'Erro interno do servidor'
      });
    }
  },

  // PUT /api/admin/store/status
  async updateStatus(req, res) {
    try {
      const {
        closedNow,
        reason,
        reopenAt,
        notifyWhatsApp,
        notifyEmail,
        isManualMode
      } = req.body;

      const updatedStatus = await StoreStatus.update({
        closed_now: closedNow,
        reason: reason,
        reopen_at: reopenAt,
        notify_whatsapp: notifyWhatsApp,
        notify_email: notifyEmail,
        is_manual_mode: isManualMode
      });

      try {
        const io = req.app?.get('io');
        const monitor = req.app?.get('storeMonitor');
        if (io) {
          // Notificar admin e clientes para atualização imediata do status (com payload)
          const status = await StoreStatus.get();
          const hours = await StoreHours.getAll();
          const { composePublicStatus } = require('../../utils/storeStatus');
          const payload = composePublicStatus(status, hours);
          io.of('/admin').emit('dashboard:update', { reason: 'admin-update-status', status: payload });
          io.of('/cliente').emit('store:status', payload);
        }
        // Recalibrar monitor para próximos limites de horário
        try { await monitor?.refresh(); } catch (_) {}
      } catch (_) { /* noop */ }

      res.json({
        sucesso: true,
        mensagem: 'Status da loja atualizado com sucesso',
        data: updatedStatus
      });
    } catch (error) {
      console.error('Erro ao atualizar status da loja:', error);
      res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao atualizar status da loja'
      });
    }
  },

  // PUT /api/admin/store/hours
  async updateHours(req, res) {
    try {
      const { hours } = req.body;
      
      if (!Array.isArray(hours) || hours.length !== 7) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Deve fornecer array com 7 horários'
        });
      }

      const updatedHours = await StoreHours.update(hours);

      try {
        const io = req.app?.get('io');
        const monitor = req.app?.get('storeMonitor');
        if (io) {
          const status = await StoreStatus.get();
          const hours = await StoreHours.getAll();
          const { composePublicStatus } = require('../../utils/storeStatus');
          const payload = composePublicStatus(status, hours);
          io.of('/admin').emit('dashboard:update', { reason: 'admin-update-hours', status: payload });
          io.of('/cliente').emit('store:status', payload);
        }
        // Recalibrar monitor para próximos limites de horário
        try { await monitor?.refresh(); } catch (_) {}
      } catch (_) { /* noop */ }

      res.json({
        sucesso: true,
        mensagem: 'Horários de funcionamento atualizados com sucesso',
        data: updatedHours
      });
    } catch (error) {
      console.error('Erro ao atualizar horários:', error);
      res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao atualizar horários de funcionamento'
      });
    }
  },

  // POST /api/admin/store/hours/reset
  async resetHours(req, res) {
    try {
      const defaultHours = await StoreHours.reset();

      res.json({
        sucesso: true,
        mensagem: 'Horários resetados para o padrão',
        data: defaultHours
      });
    } catch (error) {
      console.error('Erro ao resetar horários:', error);
      res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao resetar horários'
      });
    }
  }
};

module.exports = StoreController;
