const Settings = require('../../models/Settings');

const PublicSettingsController = {
  async getSettings(req, res) {
    try {
      const s = await Settings.get();
      res.json({
        sucesso: true,
        data: {
          from_default: s.__source === 'default',
          name: s.name,
          phone: s.phone,
          email: s.email,
          address: s.address,
        }
      });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar configurações públicas' });
    }
  }
};

module.exports = PublicSettingsController;
