const Settings = require('../../models/Settings');

function sanitizeStr(s, max = 500) {
  if (s == null) return null;
  const noTags = String(s).replace(/<[^>]*>/g, '').trim();
  return noTags.slice(0, max);
}

const AdminSettingsController = {
  async get(req, res) {
    try {
      const data = await Settings.get();
      res.json({ sucesso: true, data });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar configurações' });
    }
  },

  async update(req, res) {
    try {
      const payload = {
        name: sanitizeStr(req.body.name, 255),
        phone: sanitizeStr(req.body.phone, 50),
        email: sanitizeStr(req.body.email, 255),
        address: sanitizeStr(req.body.address, 1000),
      };
      const updated = await Settings.update(payload);
      res.json({ sucesso: true, data: updated });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar configurações' });
    }
  },

  async updateNotifications(req, res) {
    try {
      const enabled = !!req.body.notification_enabled;
      let sound = req.body.notification_sound;
      sound = sanitizeStr(sound, 255);
      const updated = await Settings.update({
        notification_enabled: enabled ? 1 : 0,
        notification_sound: sound || null,
      });
      res.json({ sucesso: true, data: updated });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar preferências de notificação' });
    }
  },
};

module.exports = AdminSettingsController;
// Configurações da loja