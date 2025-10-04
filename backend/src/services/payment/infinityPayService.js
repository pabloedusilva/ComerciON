// Integração InfinitePay - geração de link de checkout com segurança
// Observação: InfinitePay aceita um link do tipo
// https://checkout.infinitepay.io/<handle>?items=[{...}]&order_nsu=...&redirect_url=...
// Aqui nós construímos esse link no backend, assinamos um token de verificação
// (para validar o redirect de sucesso) e retornamos a URL final ao cliente autenticado.

const crypto = require('crypto');

function encodeItemsParam(items) {
	// Gera JSON compacto e com caracteres seguros para URL
	// Ex.: [{"name":"Produto+1","price":1000,"quantity":1}]
	const allowImage = String(process.env.INFINITEPAY_SEND_IMAGE_URLS || 'false') === 'true';
	const json = JSON.stringify(items.map(it => {
		const priceCents = Math.max(1, Math.round(Number(it.price)||0));
		const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
		const base = {
			name: String(it.name || '').slice(0, 120),
			price: priceCents,
			quantity: qty
		};
		const imageUrl = it.image_url;
		if (allowImage && imageUrl && /^https?:\/\//i.test(String(imageUrl))) {
			// Adiciona image_url apenas se for URL absoluta HTTP(S)
			base.image_url = String(imageUrl).slice(0, 512);
		}
		return base;
	}));
	return encodeURIComponent(json);
}

function hmacSign(payload, secret) {
	return crypto.createHmac('sha256', String(secret || '')).update(String(payload)).digest('hex');
}

function base64urlEncode(obj) {
	const raw = Buffer.from(JSON.stringify(obj));
	return raw.toString('base64url');
}

function base64urlDecode(str) {
	const raw = Buffer.from(String(str || ''), 'base64url');
	return JSON.parse(raw.toString('utf8'));
}

/**
 * buildCheckoutLink
 * @param {Object} opts
 * @param {string} opts.handle           - Seu handle InfinitePay (ex.: maria)
 * @param {Array}  opts.items            - Itens no formato { name, price (centavos), quantity }
 * @param {string} opts.orderNSU         - Identificador único do pedido (ex.: ID interno)
 * @param {string} opts.redirectBaseUrl  - URL base pública para redirecionar (ex.: https://seusite.com)
 * @param {string} opts.successPath      - Caminho de sucesso (ex.: /pay/sucesso)
 * @param {string} opts.hmacSecret       - Segredo para assinar o token de sucesso
 * @returns {string} URL completa do checkout InfinitePay
 */
function buildCheckoutLink({ handle, items, orderNSU, redirectBaseUrl, successPath = '/pay/sucesso', hmacSecret }) {
	if (!handle) throw new Error('InfinitePay handle ausente');
	if (!Array.isArray(items) || items.length === 0) throw new Error('Itens ausentes');
	if (!orderNSU) throw new Error('orderNSU ausente');

	const itemsParam = encodeItemsParam(items);

	// Gerar token para validar o retorno na página de sucesso
	const nowSec = Math.floor(Date.now() / 1000);
	const nonce = crypto.randomBytes(8).toString('hex');
	const stateObj = { o: String(orderNSU), t: nowSec, n: nonce };
	const state = base64urlEncode(stateObj);
	const token = hmacSign(state, hmacSecret || '');

	const redirectUrl = new URL(successPath, redirectBaseUrl);
	redirectUrl.searchParams.set('order', String(orderNSU));
	redirectUrl.searchParams.set('state', state);
	redirectUrl.searchParams.set('sig', token);

	// Alguns usuários informam handle com prefixos como "$" ou "@"; normalizamos para o slug aceito na URL
	const handleSlug = String(handle).trim().replace(/^[@$]+/, '');
	const base = `https://checkout.infinitepay.io/${encodeURIComponent(handleSlug)}`;
	const url = `${base}?items=${itemsParam}&order_nsu=${encodeURIComponent(orderNSU)}&redirect_url=${encodeURIComponent(redirectUrl.toString())}`;
	return url;
}

/**
 * Valida o retorno de sucesso baseado no state assinado.
 * @param {string} state - Base64URL do objeto { o: orderId, t: epochSec, n: nonce }
 * @param {string} sig - Assinatura hex HMAC-SHA256(state)
 * @param {string} secret - Segredo HMAC compartilhado
 * @param {number} maxAgeSec - Tempo máximo de validade do state, em segundos
 * @returns {{ ok: boolean, order: string|null, reason?: string }}
 */
function validateSuccessState(state, sig, secret, maxAgeSec = 1800) {
	try {
		if (!state || !sig) return { ok: false, order: null, reason: 'missing' };
		const expected = hmacSign(String(state), String(secret || ''));
		if (expected !== sig) return { ok: false, order: null, reason: 'bad_sig' };
		const obj = base64urlDecode(state);
		const order = String(obj.o || '');
		const ts = Number(obj.t || 0);
		if (!order || !Number.isFinite(ts)) return { ok: false, order: null, reason: 'bad_state' };
		const now = Math.floor(Date.now() / 1000);
		if (now - ts > maxAgeSec) return { ok: false, order: null, reason: 'expired' };
		return { ok: true, order };
	} catch (_) {
		return { ok: false, order: null, reason: 'parse_error' };
	}
}

module.exports = { buildCheckoutLink, hmacSign, validateSuccessState };
// Integração Infinity Pay