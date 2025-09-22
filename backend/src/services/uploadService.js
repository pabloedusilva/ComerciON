// Upload imagens - salva base64 como arquivo em /public/uploads
const fs = require('fs');
const path = require('path');

function ensureDirSync(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function parseDataUrl(dataUrl) {
	// data:image/png;base64,XXXXX
	const match = /^data:(.+);base64,(.*)$/.exec(dataUrl || '');
	if (!match) return null;
	return { mime: match[1], base64: match[2] };
}

function extFromMime(mime) {
	const map = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/webp': 'webp',
		'image/gif': 'gif'
	};
	return map[mime] || 'png';
}

async function saveBase64Image(dataUrl, folder = 'products') {
	const parsed = parseDataUrl(dataUrl);
	if (!parsed) return null;

	// Validar MIME permitido
	const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
	if (!allowed.has(parsed.mime)) {
		throw new Error('Formato de imagem não permitido. Use PNG, JPG, WEBP ou GIF.');
	}

	// Validar tamanho (3MB)
	const buffer = Buffer.from(parsed.base64, 'base64');
	const maxBytes = 3 * 1024 * 1024;
	if (buffer.length > maxBytes) {
		throw new Error('Imagem muito grande (máx 3MB)');
	}

	const ext = extFromMime(parsed.mime);
	const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
	const uploadsDir = path.join(__dirname, '../../public/uploads', folder);
	const filePath = path.join(uploadsDir, fileName);

	ensureDirSync(uploadsDir);

	await fs.promises.writeFile(filePath, buffer);

	// URL pública servida por app.js em /uploads
	const publicUrl = `/uploads/${folder}/${fileName}`;
	return publicUrl;
}

	function toUploadsFilePath(publicUrl) {
		if (!publicUrl || typeof publicUrl !== 'string') return null;
		if (!publicUrl.startsWith('/uploads/')) return null; // só apaga arquivos locais
		const relative = publicUrl.replace(/^\/+/, ''); // remove leading slashes
		const full = path.join(__dirname, '../../public', relative);
		// Evitar path traversal saindo de /public/uploads
		const base = path.join(__dirname, '../../public/uploads');
		const normalized = path.normalize(full);
		if (!normalized.startsWith(base)) return null;
		return normalized;
	}

	async function deleteImageByUrl(publicUrl) {
		const filePath = toUploadsFilePath(publicUrl);
		if (!filePath) return false;
		try {
			await fs.promises.unlink(filePath);
			return true;
		} catch (e) {
			// Se já não existe, ignore
			return false;
		}
	}

module.exports = {
		saveBase64Image,
		deleteImageByUrl
};