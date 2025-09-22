const Product = require('../../models/Product');
const { saveBase64Image, deleteImageByUrl } = require('../../services/uploadService');

const productsController = {
	async list(req, res) {
		try {
			const items = await Product.listAll({ onlyActive: false });
			res.json({ sucesso: true, data: items });
		} catch (error) {
			console.error('Erro ao listar produtos:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar produtos' });
		}
	},

	async create(req, res) {
		try {
			const { name, category, description, price, img, status } = req.body;
			if (!name || !category || !price) {
				return res.status(400).json({ sucesso: false, mensagem: 'Campos obrigatórios ausentes' });
			}
			// Se vier base64, salvar arquivo e trocar por URL
			let imageToStore = img;
			if (typeof img === 'string' && img.startsWith('data:image')) {
				const url = await saveBase64Image(img, 'products');
				imageToStore = url;
			}
			const created = await Product.create({ name, category, description, price, img: imageToStore, status });
			res.status(201).json({ sucesso: true, data: created });
		} catch (error) {
			console.error('Erro ao criar produto:', error);
			const mensagem = error && typeof error.message === 'string' ? error.message : 'Erro ao criar produto';
			const status = mensagem.includes('Imagem') || mensagem.includes('Formato de imagem') ? 400 : 500;
			res.status(status).json({ sucesso: false, mensagem });
		}
	},

	async update(req, res) {
		try {
			const id = parseInt(req.params.id);
			const { name, category, description, price, img, status } = req.body;
			// Buscar registro atual
			const current = await Product.findById(id);
			if (!current) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado' });

			let imageToStore = current.img; // por padrão, manter imagem atual
			if (typeof img === 'string' && img.startsWith('data:image')) {
				// Novo upload em base64
				const url = await saveBase64Image(img, 'products');
				imageToStore = url;
			} else if (typeof img === 'string' && img.startsWith('/uploads/')) {
				// Já recebemos uma URL local válida (caso de manutenção explícita)
				imageToStore = img;
			} else if (img === null || img === '') {
				// Se vier null/'' explicitamente, remover imagem
				imageToStore = null;
			}

			const updated = await Product.update(id, { name, category, description, price, img: imageToStore, status });
			if (!updated) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado' });
			// Se trocou a URL e a antiga era local, remover arquivo
			if (current && current.img && updated.img !== current.img) {
				await deleteImageByUrl(current.img);
			}
			res.json({ sucesso: true, data: updated });
		} catch (error) {
			console.error('Erro ao atualizar produto:', error);
			const mensagem = error && typeof error.message === 'string' ? error.message : 'Erro ao atualizar produto';
			const status = mensagem.includes('Imagem') || mensagem.includes('Formato de imagem') ? 400 : 500;
			res.status(status).json({ sucesso: false, mensagem });
		}
	},

	async remove(req, res) {
		try {
			const id = parseInt(req.params.id);
			const current = await Product.findById(id);
			const ok = await Product.remove(id);
			if (!ok) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado' });
			if (current && current.img) {
				await deleteImageByUrl(current.img);
			}
			res.json({ sucesso: true });
		} catch (error) {
			console.error('Erro ao remover produto:', error);
			res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover produto' });
		}
	}
};

module.exports = productsController;