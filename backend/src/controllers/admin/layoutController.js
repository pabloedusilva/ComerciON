const StoreSettings = require('../../models/StoreSettings');
const { saveBase64Image, deleteImageByUrl } = require('../../services/uploadService');

function sanitizeStr(s, max = 500) {
  if (s == null) return null;
  const noTags = String(s).replace(/<[^>]*>/g, '').trim();
  return noTags.slice(0, max);
}

const LayoutController = {
  async getSettings(req, res) {
    try {
      const settings = await StoreSettings.get();
      res.json({ sucesso: true, data: settings });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar configurações' });
    }
  },

  async updateLogo(req, res) {
    try {
      const { image } = req.body; // pode ser url ou dataURL base64
      if (!image) return res.status(400).json({ sucesso: false, mensagem: 'Imagem é obrigatória' });

      const current = await StoreSettings.get();
      let logoUrl = image;
      if (/^data:image\//.test(image)) {
        // upload local seguro
        logoUrl = await saveBase64Image(image, 'site');
      }
      // apaga antiga se era local
      if (current.logo_url && current.logo_url !== logoUrl) {
        await deleteImageByUrl(current.logo_url);
      }
      const updated = await StoreSettings.update({ logo_url: logoUrl });
      res.json({ sucesso: true, data: updated });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message || 'Erro ao atualizar logo' });
    }
  },

  async updateBackground(req, res) {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ sucesso: false, mensagem: 'Imagem é obrigatória' });

      const current = await StoreSettings.get();
      let bgUrl = image;
      if (/^data:image\//.test(image)) {
        bgUrl = await saveBase64Image(image, 'site');
      }
      if (current.home_background_url && current.home_background_url !== bgUrl) {
        await deleteImageByUrl(current.home_background_url);
      }
      const updated = await StoreSettings.update({ home_background_url: bgUrl });
      res.json({ sucesso: true, data: updated });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message || 'Erro ao atualizar background' });
    }
  },

  async updateHomeTexts(req, res) {
    try {
      const title = sanitizeStr(req.body.title, 255);
      const subtitle = sanitizeStr(req.body.subtitle, 255);
      const description = sanitizeStr(req.body.description, 2000);
      const updated = await StoreSettings.update({
        home_title: title,
        home_subtitle: subtitle,
        home_description: description,
      });
      res.json({ sucesso: true, data: updated });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar textos' });
    }
  },

  async updateCarousel(req, res) {
    try {
      let { slides } = req.body; // [{image, caption}]
      if (!Array.isArray(slides) || slides.length === 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Slides inválidos' });
      }
      // carregar atual para eventualmente deletar imagens antigas
      const current = await StoreSettings.get();
      const oldUrls = new Set((current.carousel || []).map(s => s.image_url).filter(Boolean));

      const processed = [];
      for (const s of slides) {
        if (!s || !s.image) continue;
        let url = s.image;
        if (/^data:image\//.test(s.image)) {
          url = await saveBase64Image(s.image, 'site');
        }
        processed.push({ image_url: url, caption: sanitizeStr(s.caption, 255) || '' });
        // manter url usada
        oldUrls.delete(url);
      }
      if (processed.length === 0) return res.status(400).json({ sucesso: false, mensagem: 'Nenhum slide válido' });

      const updated = await StoreSettings.update({ carousel: processed });

      // apagar arquivos locais que não estão mais em uso
      for (const leftover of oldUrls) {
        await deleteImageByUrl(leftover);
      }
      res.json({ sucesso: true, data: updated });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message || 'Erro ao atualizar carousel' });
    }
  },

  async updateInstagram(req, res) {
    try {
      const enabled = !!req.body.enabled;
      const text = sanitizeStr(req.body.text, 255);
      const handle = sanitizeStr((req.body.handle || '').replace(/^@+/, ''), 100);
      const updated = await StoreSettings.update({
        instagram_enabled: enabled ? 1 : 0,
        instagram_text: text,
        instagram_handle: handle,
      });
      res.json({ sucesso: true, data: updated });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar Instagram' });
    }
  },
};

module.exports = LayoutController;// Layout e customização