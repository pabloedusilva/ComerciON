const Layout = require('../../models/Layout');

const PublicLayoutController = {
  async getLayout(req, res) {
    try {
  const settings = await Layout.get();
      // Expor apenas o necessário
      res.json({
        sucesso: true,
        data: {
          logo_url: settings.logo_url,
          home_background_url: settings.home_background_url,
          home_title: settings.home_title,
          home_subtitle: settings.home_subtitle,
          home_description: settings.home_description,
          carousel: settings.carousel,
          instagram: {
            enabled: !!settings.instagram_enabled,
            text: settings.instagram_text,
            handle: settings.instagram_handle,
          }
        }
      });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar layout' });
    }
  }
};

module.exports = PublicLayoutController;