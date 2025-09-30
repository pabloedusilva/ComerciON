// Checkout protegido: valida auth, loja aberta, carrinho não vazio; preenche perfil/endereço; calcula taxa; salva perfil; cria pedido; gera link InfinitePay.
(function(){
	const $ = (sel)=> document.querySelector(sel);
	const $$ = (sel)=> Array.from(document.querySelectorAll(sel));

	function showLoader(on){
		try{ const el = document.querySelector('.loader-content'); if (!el) return; if (on) el.classList.add('show'); else el.classList.remove('show'); }catch(_){}
	}
	async function fetchStoreStatus(){
		try { const r = await fetch('/api/public/store', { cache:'no-store' }); const j = await r.json(); return j?.data || {}; } catch(_) { return { effectiveClosed:true, closedNow:true }; }
	}
	function showClosedModal(msg, reopenAt){
		const area = document.getElementById('storeClosedModal'); if (!area) { alert(msg || 'Estamos fechados no momento.'); return; }
		const p = document.getElementById('storeClosedMsg');
		const parts = [];
		if (msg) parts.push(String(msg));
		if (reopenAt) { try { const d = new Date(reopenAt); if (!isNaN(d)) parts.push(`Previsão de reabertura: ${d.toLocaleString('pt-BR')}`); } catch(_){} }
		p.textContent = parts.join(' — ') || 'Volte mais tarde para finalizar seu pedido.';
		area.style.display = 'flex';
		const close = ()=> { area.style.display = 'none'; };
		document.getElementById('storeClosedOk')?.addEventListener('click', close, { once:true });
		area.addEventListener('click', (e)=>{ if (e.target === area) close(); }, { once:true });
	}

	function maskCep(v){ const d = String(v||'').replace(/\D/g,'').slice(0,8); return d.length>5 ? `${d.slice(0,5)}-${d.slice(5)}` : d; }
	function normalizeCep(v){ return String(v||'').replace(/\D/g,'').slice(0,8); }
	const fmt = (n)=> Number(n||0).toLocaleString('pt-br',{ style:'currency', currency:'BRL' });
	let lastFee = 0; let serviceAvailable = false;

	async function guard(){
		// 1) Auth obrigatório
		const auth = window.AuthSystem;
		const token = auth && typeof auth.getToken === 'function' ? auth.getToken() : (auth && auth.token);
		if (!token) { window.location.replace('/login?redirect=/checkout'); return false; }

		// 2) Loja aberta
		const status = await fetchStoreStatus();
		if (status.effectiveClosed === true || status.closedNow === true) { showClosedModal(status.reason, status.reopenAt); return false; }

		// 3) Carrinho não vazio
		let c = [];
		try { c = JSON.parse(localStorage.getItem('produto_cart')||'[]'); } catch(_) { c = []; }
		if (!Array.isArray(c) || c.length === 0) { window.location.replace('/menu#checkout'); return false; }
		return true;
	}

	async function loadProfile(){
		try{
			const r = await fetch('/api/customer/profile', { headers: authHeader() });
			const j = await r.json();
			if (!r.ok || !j?.sucesso) throw new Error('fail');
			return j.usuario || {};
		} catch(_){ return {}; }
	}
	function authHeader(){
		const auth = window.AuthSystem; const token = auth && typeof auth.getToken==='function' ? auth.getToken() : (auth && auth.token);
		return token ? { Authorization: `Bearer ${token}` } : {};
	}
	async function loadCatalogMap(){
		try {
			const r = await fetch('/api/public/catalog/products', { cache: 'no-store' });
			const j = await r.json();
			if (!r.ok || !j?.sucesso) throw new Error('catalog');
			const arr = Array.isArray(j.data) ? j.data : [];
			const map = new Map();
			arr.forEach(p=>{ if (p && p.id != null) map.set(Number(p.id), p); });
			return map;
		} catch(_) { return new Map(); }
	}
	async function viaCEP(cep){
		const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache:'no-store' });
		const data = await res.json(); if (data.erro) throw new Error('CEP não encontrado');
		return { endereco: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', estado: (data.uf||'').toUpperCase() };
	}
	async function fetchFee(city, uf){
		const q = new URLSearchParams({ city, uf }).toString();
		const r = await fetch(`/api/public/delivery/fee?${q}`, { cache:'no-store' });
		const j = await r.json(); if (!j || !j.sucesso) throw new Error('Falha ao consultar taxa');
		return j.fee; // number ou null
	}

		// No personal fields on checkout per request
		function fillPersonal(u) { /* noop */ }
	function fillAddress(u){
		$('#cep').value = u.cep ? maskCep(u.cep) : '';
		$('#endereco').value = u.endereco || '';
		$('#numero').value = u.numero || '';
		$('#complemento').value = u.complemento || '';
		$('#bairro').value = u.bairro || '';
		$('#cidade').value = u.cidade || '';
		$('#estado').value = u.estado || '';
	}
		// Single-page: no stepper

		function validateAddress(){
		let ok = true; const ids = ['cep','endereco','numero','bairro','cidade','estado'];
		ids.forEach(id=>{ const el = $('#'+id); if (!el.value.trim()) { el.classList.add('field-error'); ok=false; } else el.classList.remove('field-error'); });
		const cep = normalizeCep($('#cep').value); if (cep.length !== 8) { $('#cep').classList.add('field-error'); ok = false; }
		const uf = $('#estado').value.trim(); if (uf.length !== 2) { $('#estado').classList.add('field-error'); ok = false; }
		return ok;
	}

	function getCart(){
		try {
			let raw = localStorage.getItem('produto_cart');
			if (!raw) raw = localStorage.getItem('produto_cart_backup');
			const c = JSON.parse(raw || '[]');
			return Array.isArray(c) ? c : [];
		} catch(_) { return []; }
	}
	function getCouponInfo(){
		try { return JSON.parse(localStorage.getItem('pizzaria_coupon')||'null') || {}; } catch(_) { return {}; }
	}
	function resolveCouponPercent(code){
		if (!code) return 0;
		const up = String(code).trim().toUpperCase();
		if (up === 'SITE10') return 10;
		return 0;
	}
	function computeTotals(items, fee){
		const map = window.__catalogMap || new Map();
		const produtosValor = items.reduce((acc,it)=>{
			let unit = Number(it.price||0);
			if (!unit || !isFinite(unit)) {
				try {
					const p = map.get(Number(it.id));
					if (p && Array.isArray(p.price)) {
						const sz = Number(it.size)||0;
						const candidate = Number(p.price[sz]||0);
						if (candidate > 0) unit = candidate;
					}
				} catch(_) {}
			}
			return acc + (unit * Number(it.qt||0));
		}, 0);
		const entrega = Number(fee||0);
		const subtotal = produtosValor + entrega;
		const c = getCouponInfo();
		const pct = resolveCouponPercent(c.code);
		const desconto = pct > 0 ? (subtotal * (pct/100)) : 0;
		const total = subtotal - desconto;
		return { produtosValor, entrega, subtotal, desconto, total, couponCode: c.code || null, couponPercent: pct };
	}
		function renderItemsAndTotals(fee, opts){
		const items = getCart();
		const cont = $('#orderItems'); cont.innerHTML = '';
		items.forEach(it=>{
			let p = window.__catalogMap && window.__catalogMap.get ? window.__catalogMap.get(Number(it.id)) : null;
			const baseImg = '../../assets/images/default-images/produto-padrao.png';
			const img = p?.img || baseImg;
			let sizeName = '';
			try {
				const arr = Array.isArray(p?.price) ? p.price.map(n=>Number(n)||0) : [];
				const available = arr.filter(v=>v>0).length;
				if (available === 1) sizeName = 'Único';
				else sizeName = ['Pequeno','Médio','Grande'][Number(it.size)||0] || '';
			} catch(_) {}
			const name = p?.name || `Item #${it.id}`;
			const html = `<div class="order-item">
				<img src="${img}" alt="" />
				<div>
					<div class="name">${name}${sizeName?` (${sizeName})`:''}</div>
					${it.removedIngredients?`<div class="details">Sem: ${it.removedIngredients}</div>`:''}
				</div>
				<div class="qty">x${it.qt}</div>
			</div>`;
			cont.insertAdjacentHTML('beforeend', html);
		});
		const t = computeTotals(items, fee);
		$('#resumoItens').textContent = fmt(t.produtosValor);
		$('#resumoEntrega').textContent = fmt(t.entrega);
		$('#resumoSubtotal').textContent = fmt(t.subtotal);
		$('#resumoDesconto').textContent = fmt(t.desconto);
		$('#resumoTotal').textContent = fmt(t.total);
		// Atualiza label do desconto dinamicamente
		const lbl = $('#resumoDescontoLabel');
		if (lbl) {
			if (t.couponPercent > 0 && t.couponCode) {
				lbl.textContent = `Desconto (${t.couponCode.toUpperCase()} - ${t.couponPercent}%)`;
			} else {
				lbl.textContent = 'Desconto';
			}
		}
			const city = ($('#cidade').value||'').trim(); const uf = ($('#estado').value||'').trim().toUpperCase();
			const info = $('#deliveryInfo');
			if (opts && opts.notServed) {
				info.style.color = '#b91c1c';
				info.textContent = 'No momento não entregamos para esta região.';
			} else if (city && uf && typeof fee === 'number') {
				info.style.color = '#666';
				info.textContent = `Entrega para ${city}/${uf}. Taxa: ${fmt(fee)}.`;
			} else {
				info.style.color = '#666';
				info.textContent = 'Informe o CEP para calcular a taxa de entrega e validar a região atendida.';
			}
			const btn = $('#goPayment');
			serviceAvailable = !(opts && opts.notServed) && (city && uf);
			btn.setAttribute('aria-disabled', serviceAvailable ? 'false' : 'true');
			btn.toggleAttribute('disabled', !serviceAvailable);
		return t;
	}

	async function updateFeeAndTotalsFromFields(){
		try {
			const city = ($('#cidade').value||'').trim(); const uf = ($('#estado').value||'').trim().toUpperCase();
			if (!city || !uf) { lastFee = 0; renderItemsAndTotals(0); return; }
			const f = await fetchFee(city, uf);
			if (typeof f === 'number') { lastFee = f; renderItemsAndTotals(f, { notServed: false }); }
			else { lastFee = 0; renderItemsAndTotals(0, { notServed: true }); }
		} catch(_) { lastFee = 0; renderItemsAndTotals(0, { notServed: true }); }
	}

		async function saveProfileIfChanged(_personal, address){
			const payload = { endereco: address.endereco, numero: address.numero, bairro: address.bairro, complemento: address.complemento, cidade: address.cidade, estado: address.estado, cep: address.cep };
		try {
			const r = await fetch('/api/customer/profile', { method:'PUT', headers: { 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify(payload) });
			const j = await r.json();
			if (!r.ok || !j.sucesso) throw new Error(j?.mensagem || 'Falha ao salvar perfil');
			return true;
		} catch(_) { return false; }
	}

		async function createOrderAndPay(address){
		const items = getCart();
		const headers = { 'Content-Type': 'application/json', ...authHeader() };
		// Enviar endereço para não depender do snapshot incompleto
		const orderResp = await fetch('/api/customer/orders', { method:'POST', headers, body: JSON.stringify({ items, address }) });
		const orderJson = await orderResp.json().catch(()=>({}));
		if (!orderResp.ok || !orderJson.sucesso) throw new Error(orderJson?.mensagem || 'Falha ao criar pedido');
		const orderId = orderJson.data?.id; if (!orderId) throw new Error('Pedido inválido');
		const linkResp = await fetch('/api/customer/payment/infinitepay/checkout-link', { method:'POST', headers, body: JSON.stringify({ orderId }) });
		const linkJson = await linkResp.json().catch(()=>({}));
		if (!linkResp.ok || !linkJson.sucesso || !linkJson.url) throw new Error(linkJson?.mensagem || 'Falha ao gerar link de pagamento');
		window.location.href = linkJson.url;
	}

		document.addEventListener('DOMContentLoaded', async ()=>{
		try {
		// Guarda inicial
		const ok = await guard(); if (!ok) return;

		// Render imediato com itens e taxa 0, para não mostrar R$ --
		renderItemsAndTotals(0);

		// Carregar catálogo para exibir nomes/imagens corretos
		window.__catalogMap = await loadCatalogMap();

			// Carregar perfil e preencher
			const u = await loadProfile(); fillPersonal(u); fillAddress(u);
			// Se temos CEP mas (bairro/cidade/estado) faltam, auto-buscar ViaCEP
			try {
				const cepRaw = normalizeCep($('#cep').value);
				if (cepRaw.length === 8 && (!$('#bairro').value || !$('#cidade').value || !$('#estado').value)) {
					const a = await viaCEP(cepRaw);
					if (!$('#endereco').value) $('#endereco').value = a.endereco;
					if (!$('#bairro').value) $('#bairro').value = a.bairro;
					if (!$('#cidade').value) $('#cidade').value = a.cidade;
					if (!$('#estado').value) $('#estado').value = a.estado;
				}
			} catch(_) {}
			// Se já temos cidade/UF do perfil, calcular taxa e atualizar totais
			await updateFeeAndTotalsFromFields();

			// CEP mask and auto-fill on blur
				const cep = $('#cep'); const cepErr = $('#cepError'); const buscar = $('#buscarCep');
			cep.addEventListener('input', ()=>{ cep.value = maskCep(cep.value); cep.classList.remove('field-error'); cepErr.textContent=''; });
			cep.addEventListener('blur', async ()=>{
				const c = normalizeCep(cep.value);
				if (c.length !== 8) return;
				try { const a = await viaCEP(c); if (!$('#endereco').value) $('#endereco').value = a.endereco; if (!$('#bairro').value) $('#bairro').value = a.bairro; if (!$('#cidade').value) $('#cidade').value = a.cidade; if (!$('#estado').value) $('#estado').value = a.estado; }
				catch(_) { /* silent */ }
				await updateFeeAndTotalsFromFields();
			});
				buscar?.addEventListener('click', async ()=>{
					cepErr.textContent = '';
					const c = normalizeCep(cep.value);
					if (c.length !== 8) { cep.classList.add('field-error'); cepErr.textContent = 'CEP inválido'; return; }
					buscar.disabled = true;
					try { const a = await viaCEP(c); $('#endereco').value = a.endereco; $('#bairro').value = a.bairro; $('#cidade').value = a.cidade; $('#estado').value = a.estado; } catch(_) { cepErr.textContent = 'Não foi possível buscar o CEP.'; }
					finally { buscar.disabled = false; }
					await updateFeeAndTotalsFromFields();
				});

				// Auto-uppercase UF input
				try { const ufEl = $('#estado'); ufEl.addEventListener('input', ()=>{ ufEl.value = (ufEl.value||'').toUpperCase().slice(0,2); }); } catch(_) {}

				// Se não renderizou acima, garanta um primeiro render
				if (!$('#resumoTotal').textContent || $('#resumoTotal').textContent.includes('--')) { renderItemsAndTotals(0); }
				['cidade','estado','endereco','numero','bairro'].forEach(id => {
				const el = $('#'+id);
				el.addEventListener('blur', async ()=>{
						if (!$('#cidade').value || !$('#estado').value) return;
					await updateFeeAndTotalsFromFields();
				});
			});

		$('#goPayment').addEventListener('click', async (e)=>{
			e.preventDefault();
						if (!validateAddress()) return;
						if (!serviceAvailable) { alert('No momento não entregamos para esta região.'); return; }
			showLoader(true);
			try {
							const address = { cep: normalizeCep($('#cep').value), endereco: $('#endereco').value.trim(), numero: $('#numero').value.trim(), complemento: $('#complemento').value.trim(), bairro: $('#bairro').value.trim(), cidade: $('#cidade').value.trim(), estado: $('#estado').value.trim().toUpperCase() };
							await saveProfileIfChanged(null, address);
							await createOrderAndPay(address);
			} catch(err) {
				console.error('Falha na finalização:', err);
				alert('Não foi possível iniciar o pagamento agora. Tente novamente.');
			} finally { showLoader(false); }
		});
		} catch(err) {
			console.error('Erro ao iniciar checkout:', err);
			try { renderItemsAndTotals(0); } catch(_) {}
		}
	});
})();
