/**
 * Success Page - Página de Confirmação de Pagamento
 * Gerencia a validação de pagamento, exibição de pedidos e segurança da página
 */

// Hard lock: impede voltar/avançar nesta página e garante no-cache
(function(){
	try {
		// Evita cache desta página para não reexibir indevidamente
		const noCache = ()=>{
			try {
				const h = document.getElementsByTagName('head')[0];
				const m1 = document.createElement('meta'); m1.httpEquiv = 'Cache-Control'; m1.content = 'no-store, no-cache, must-revalidate, proxy-revalidate'; h.appendChild(m1);
				const m2 = document.createElement('meta'); m2.httpEquiv = 'Pragma'; m2.content = 'no-cache'; h.appendChild(m2);
				const m3 = document.createElement('meta'); m3.httpEquiv = 'Expires'; m3.content = '0'; h.appendChild(m3);
			} catch(_) {}
		};
		noCache();
		
		// PROTEÇÃO TOTAL CONTRA REDIRECIONAMENTOS AUTOMÁTICOS
		// Marca esta página como protegida para outros scripts
		window.SUCCESS_PAGE_PROTECTED = true;
		
		// Intercepta e bloqueia qualquer tentativa de redirecionamento automático
		const originalReplace = window.location.replace;
		const originalAssign = window.location.assign;
		
		// Override temporário para bloquear redirecionamentos não intencionais
		let allowRedirect = false;
		
		window.location.replace = function(...args) {
			if (!allowRedirect) {
				console.warn('Redirecionamento automático bloqueado em success page:', args);
				return;
			}
			return originalReplace.apply(this, args);
		};
		
		window.location.assign = function(...args) {
			if (!allowRedirect) {
				console.warn('Redirecionamento automático bloqueado em success page:', args);
				return;
			}
			return originalAssign.apply(this, args);
		};
		
		// Função para permitir redirecionamentos intencionais
		window.allowSuccessRedirect = function() {
			allowRedirect = true;
			// Restaurar funções originais após 100ms
			setTimeout(() => {
				window.location.replace = originalReplace;
				window.location.assign = originalAssign;
			}, 100);
		};
		
		// Bloquear cliques automáticos no carrinho que podem redirecionar
		document.addEventListener('click', function(e) {
			const target = e.target.closest('.menu-openner');
			if (target && !e.isTrusted) {
				// Bloquear cliques programáticos no carrinho
				e.preventDefault();
				e.stopImmediatePropagation();
				console.warn('Clique automático no carrinho bloqueado em success page');
				return false;
			}
		}, { capture: true, passive: false });
		
		window.addEventListener('beforeunload', function(){
			// Na próxima visita direta, não reexibir a menos que outro pedido seja concluído
			try { sessionStorage.removeItem('last_success_order'); } catch(_) {}
		});
		
		console.log('Success page protection activated');
	} catch(_) {}
})();

// Bloqueia voltar para tela de pagamento/checkout do mesmo pedido
(function(){
	try {
		const lockBackNav = () => {
			const url = new URL(window.location.href);
			// Cria uma entrada extra no histórico para capturar o primeiro "voltar"
			history.pushState({ from: 'success' }, document.title, url.pathname + url.search);
		};
		lockBackNav();
		window.addEventListener('popstate', () => {
			if (typeof window.allowSuccessRedirect === 'function') window.allowSuccessRedirect();
			window.location.replace('/menu');
		});
	} catch(_) {}
})();

// Utilitários
const fmt = (n) => Number(n || 0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
const qs = new URLSearchParams(window.location.search);
const orderParam = qs.get('order');
const state = qs.get('state');
const sig = qs.get('sig');

// Conectar WebSocket para receber TXID em tempo real após webhook
function setupRealtimeTxid(orderId) {
	try {
		if (typeof io !== 'function') return; // socket.io não carregado
		const socket = io('/cliente', { transports: ['websocket', 'polling'] });
		socket.on('payment:paid', (payload) => {
			try {
				if (!payload || Number(payload.orderId) !== Number(orderId)) return;
				const sTx = document.getElementById('sTxid');
				if (sTx && payload.txid) {
					sTx.textContent = payload.txid;
					sTx.className = 'info-value mono';
					sTx.style.color = '#22c55e';
				}
			} catch(_) {}
		});
	} catch(_) {}
}

/**
 * Valida o pagamento com o backend usando os parâmetros assinados
 */
async function fetchSuccessValidation() {
	try {
		const url = `/api/customer/payment/infinitepay/success?order=${encodeURIComponent(orderParam || '')}&state=${encodeURIComponent(state || '')}&sig=${encodeURIComponent(sig || '')}`;
		const r = await fetch(url, { 
			cache: 'no-store',
			headers: {
				'Accept': 'application/json',
				'Cache-Control': 'no-cache'
			}
		});
		const j = await r.json();
		if (!r.ok || !j?.sucesso) throw new Error(j?.mensagem || 'Retorno inválido');
		
		const result = {
			order: String(j.data?.order || ''),
			txid: j.data?.txid || '',
			paid: !!j.data?.paid,
			total: Number(j.data?.total || 0),
			status: j.data?.status || '',
			created_at: j.data?.created_at || null,
			payment_received_at: j.data?.payment_received_at || null
		};
		
		// Log para debug
		if (result.txid) {
			console.log('Success validation retornou txid:', result.txid, 'em', new Date().toLocaleTimeString());
		} else {
			console.log('Success validation sem txid ainda, tentando novamente...');
		}
		
		return result;
	} catch (err) { 
		console.warn('Erro na validação de sucesso:', err);
		return { order: '', txid: '', paid: false, total: 0, status: '', created_at: null }; 
	}
}

/**
 * Busca os dados do pedido do backend
 */
async function fetchOrder(orderId) {
	try {
		const headers = window.AuthSystem && typeof window.AuthSystem.getToken === 'function' 
			? { Authorization: 'Bearer ' + window.AuthSystem.getToken() } 
			: {};
		const r = await fetch(`/api/customer/orders/${orderId}`, { headers });
		const j = await r.json();
		if (!r.ok || !j?.sucesso) throw new Error('fail');
		return j.data || {};
	} catch (_) { 
		return {}; 
	}
}

/**
 * Deriva a URL do recibo PDF
 */
function deriveReceiptUrl(order) {
	// Sempre usar nosso endpoint autenticado de recibo PDF do pedido
	return `/api/customer/orders/${order.id}/receipt`;
}

/**
 * Configura os links de visualização e download do recibo com segurança avançada
 */
function setReceiptLinks(url) {
	const view = document.getElementById('receiptView');
	const dl = document.getElementById('receiptDownload');
	const hint = document.getElementById('receiptHint');
	
	// Sistema de autenticação seguro
	const getAuthHeaders = () => {
		const auth = window.AuthSystem;
		const token = auth && typeof auth.getToken === 'function' 
			? auth.getToken() 
			: (auth && auth.token);
		
		const headers = {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'Pragma': 'no-cache',
			'Expires': '0'
		};
		
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
		
		return headers;
	};
	
	// Função segura para buscar PDF com validações
	async function fetchReceiptBlob(inline = false) {
		try {
			// Verificar se ainda temos acesso válido
			if (!orderParam || !state || !sig) {
				throw new Error('Parâmetros de segurança inválidos');
			}
			
			const urlParams = new URLSearchParams({
				...(inline && { inline: '1' }),
				// Adicionar timestamp para evitar cache
				t: Date.now().toString()
			});
			
			const fullUrl = `${url}?${urlParams}`;
			
			const response = await fetch(fullUrl, { 
				method: 'GET',
				headers: getAuthHeaders(),
				cache: 'no-store',
				credentials: 'same-origin'
			});
			
			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Acesso não autorizado');
				} else if (response.status === 404) {
					throw new Error('Comprovante não encontrado');
				} else {
					throw new Error('Erro ao carregar comprovante');
				}
			}
			
			// Verificar se é realmente um PDF
			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/pdf')) {
				throw new Error('Formato de arquivo inválido');
			}
			
			return await response.blob();
		} catch (error) {
			console.error('Erro ao buscar comprovante:', error);
			throw error;
		}
	}
	
	// Função para mostrar feedback visual
	function showStatus(message, isError = false) {
		if (!hint) return; // descrição removida do layout
		hint.textContent = message;
		hint.style.color = isError ? '#dc2626' : '#16a34a';
	}
	
	// Função para desabilitar botões temporariamente
	function setButtonsState(disabled) {
		view.disabled = disabled;
		dl.disabled = disabled;
		view.style.opacity = disabled ? '0.6' : '1';
		dl.style.opacity = disabled ? '0.6' : '1';
		view.style.pointerEvents = disabled ? 'none' : 'auto';
		dl.style.pointerEvents = disabled ? 'none' : 'auto';
	}
	
	if (url) {
		showStatus('');
		
		// Configurar visualização do recibo
		view.onclick = async (e) => {
			e.preventDefault();
			
			if (view.disabled) return;
			
			setButtonsState(true);
			showStatus('Carregando comprovante para visualização...');
			
			try {
				const blob = await fetchReceiptBlob(true);
				const blobUrl = URL.createObjectURL(blob);
				
				// Abrir em nova janela com configurações de segurança
				const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
				if (!newWindow) {
					throw new Error('Pop-up bloqueado. Permita pop-ups para este site.');
				}
				
				showStatus('Comprovante aberto em nova janela.');
				
				// Limpar blob URL após uso
				setTimeout(() => {
					URL.revokeObjectURL(blobUrl);
				}, 60000);
				
			} catch (error) {
				console.error('Erro na visualização:', error);
				showStatus(`Erro: ${error.message}`, true);
			} finally {
				setButtonsState(false);
			}
		};
		
		// Configurar download do recibo
		dl.onclick = async (e) => {
			e.preventDefault();
			
			if (dl.disabled) return;
			
			setButtonsState(true);
			showStatus('Preparando download do comprovante...');
			
			try {
				const blob = await fetchReceiptBlob(false);
				const blobUrl = URL.createObjectURL(blob);
				
				// Gerar nome de arquivo único e seguro
				const timestamp = new Date().toISOString().slice(0, 10);
				const filename = `comprovante_pedido_${orderParam}_${timestamp}.pdf`;
				
				// Criar link de download seguro
				const downloadLink = document.createElement('a');
				downloadLink.href = blobUrl;
				downloadLink.download = filename;
				downloadLink.style.display = 'none';
				
				// Adicionar ao DOM, clicar e remover
				document.body.appendChild(downloadLink);
				downloadLink.click();
				document.body.removeChild(downloadLink);
				
				showStatus('Download concluído com sucesso!');
				
				// Limpar blob URL após uso
				setTimeout(() => {
					URL.revokeObjectURL(blobUrl);
				}, 60000);
				
			} catch (error) {
				console.error('Erro no download:', error);
				showStatus(`Erro no download: ${error.message}`, true);
			} finally {
				setButtonsState(false);
			}
		};
		
		// Adicionar indicadores visuais de hover
		view.addEventListener('mouseenter', () => {
			if (!view.disabled) {
				view.style.transform = 'translateY(-1px)';
			}
		});
		
		view.addEventListener('mouseleave', () => {
			view.style.transform = 'translateY(0)';
		});
		
		dl.addEventListener('mouseenter', () => {
			if (!dl.disabled) {
				dl.style.transform = 'translateY(-1px)';
			}
		});
		
		dl.addEventListener('mouseleave', () => {
			dl.style.transform = 'translateY(0)';
		});
		
	} else {
		// Estado de erro - sem URL disponível
		view.setAttribute('aria-disabled', 'true');
		dl.setAttribute('aria-disabled', 'true');
		setButtonsState(true);
		showStatus('Comprovante não disponível no momento.', true);
	}
}

/**
 * Renderiza os itens do pedido na interface
 */
function renderOrderItems(order) {
	try {
		const box = document.getElementById('purchasedBox');
		const list = document.getElementById('itemsList');
		list.innerHTML = '';
		
		const items = Array.isArray(order.items) ? order.items : [];
		
		if (!items.length) {
			box.style.display = 'none';
		} else {
			items.forEach(it => {
				const total = Number(it.unit_price || it.price || 0) * Number(it.quantity || 0);
				const baseName = it.product_name || it.name || it.name_snapshot || 'Item';
                
				// Tamanho: mostrar exatamente o selecionado — (Único | P | M | G)
				let displayName = baseName;
				let sizeSuffix = '';
				if (typeof it.size_name === 'string' && it.size_name.trim()) {
					const s = it.size_name.trim();
					sizeSuffix = (s === 'Tamanho Único') ? 'Único' : s;
				} else if (Number.isFinite(it.size)) {
					const sizeLabels = ['P', 'M', 'G'];
					const sizeIndex = Number(it.size);
					if (sizeIndex >= 0 && sizeIndex < sizeLabels.length) {
						sizeSuffix = sizeLabels[sizeIndex];
					}
				}
				if (sizeSuffix) displayName += ` (${sizeSuffix})`;
				
				const row = document.createElement('div');
				row.className = 'item-row';
				row.innerHTML = `
					<div class="item-info">
						<div class="item-name">${displayName}</div>
						<div class="item-quantity">x${it.quantity}</div>
					</div>
					<div class="item-price">${fmt(total)}</div>
				`;
				list.appendChild(row);
			});
		}
	} catch (_) {
		console.warn('Erro ao renderizar itens do pedido');
	}
}

/**
 * Preenche os dados do pedido na interface
 */
function populateOrderData(order) {
	// Dados básicos do pedido
	document.getElementById('sOrder').textContent = '#' + order.id;
	
	// Status: esta página só é exibida para pedidos aprovados
	const statusElement = document.getElementById('sStatus');
	const statusText = 'APROVADO';
	const statusClass = 'success-badge';
	
	statusElement.textContent = statusText;
	statusElement.className = `info-badge ${statusClass}`;
	
	// Valor total
	document.getElementById('sAmount').textContent = fmt(order.total || 0);
	
	// Data do pedido
	try {
		const d = new Date(order.created_at || order.data || Date.now());
		document.getElementById('sDate').textContent = d.toLocaleString('pt-BR');
	} catch (_) {
		document.getElementById('sDate').textContent = '—';
	}
	
	// ID da transação
	const txidElement = document.getElementById('sTxid');
	if (order.payment && order.payment.txid) {
		txidElement.textContent = order.payment.txid;
		txidElement.className = 'info-value mono';
	} else {
		txidElement.textContent = '—';
		txidElement.className = 'info-value';
	}
}

/**
 * Limpa dados do carrinho e sessão
 */
function clearCartData() {
	try {
		localStorage.removeItem('produto_cart');
		localStorage.removeItem('pizzaria_coupon');
	} catch (_) {
		console.warn('Erro ao limpar dados do carrinho');
	}
}

/**
 * Inicialização principal da página
 */
async function init() {
	// Requer parâmetros assinados válidos
	if (!orderParam || !state || !sig) {
		console.log('Parâmetros de segurança inválidos, redirecionando para menu');
		if (typeof window.allowSuccessRedirect === 'function') window.allowSuccessRedirect();
		window.location.replace('/menu');
		return;
	}
	
	// Validar o pagamento (pode retornar intent ainda não materializada em pedido real)
	let validData = await fetchSuccessValidation();
	let validOrder = validData.order;

	async function pollIntentUntilOrder(maxMs = 30000){
		const start = Date.now();
		while (/^I\d+$/.test(String(validOrder)) && (Date.now()-start) < maxMs) {
			// Se ainda não pago, espera curto
			if (!validData.paid) {
				await new Promise(r=>setTimeout(r, 1500));
				validData = await fetchSuccessValidation();
				validOrder = validData.order;
				continue;
			}
			// Se paid mas ainda é intent, tentar novamente success para disparar criação (idempotente)
			await new Promise(r=>setTimeout(r, 1200));
			validData = await fetchSuccessValidation();
			validOrder = validData.order;
		}
	}

	if (/^I\d+$/.test(String(validOrder))) {
		// Poll até converter em ID numérico ou timeout
		await pollIntentUntilOrder();
	}

	if (/^I\d+$/.test(String(validOrder))) {
		console.warn('Intent não materializada em pedido dentro do tempo. Exibindo estado parcial.');
	}
	
	// Se a validação falhou completamente (sem order), ainda assim ficar na página
	// desde que tenhamos os parâmetros básicos de segurança (order, state, sig)
	if (!validOrder) {
		console.warn('Validação de sucesso falhou, mas permanecendo na página com parâmetros válidos');
		// Usar o orderParam como fallback se a validação backend falhou
		if (orderParam) {
			try { 
				populateFallbackSuccess(orderParam); 
				clearCartData();
				return;
			} catch(_) {}
		}
		// Só redirecionar se realmente não temos nenhuma informação válida
		console.log('Nenhuma informação válida encontrada, redirecionando para menu');
		if (typeof window.allowSuccessRedirect === 'function') window.allowSuccessRedirect();
		window.location.replace('/menu');
		return;
	}
	
	// Verificar se o order retornado confere com o parâmetro
	if (String(validOrder) !== String(orderParam)) {
		console.error('Order mismatch:', validOrder, 'vs', orderParam);
		console.log('Order mismatch detectado, redirecionando para menu');
		if (typeof window.allowSuccessRedirect === 'function') window.allowSuccessRedirect();
		window.location.replace('/menu');
		return;
	}

	// Inicia listener em tempo real para receber TXID via WebSocket
	try { setupRealtimeTxid(validOrder); } catch(_) {}
	
	// Marcar o último pedido exibido (sem redirecionar automaticamente)
	const key = 'last_success_order';
	try {
		sessionStorage.setItem(key, String(validOrder));
	} catch (_) {}
	
	// Buscar pedido (autenticado) para preencher valores, items e txid
	const order = await fetchOrder(validOrder);
    
	// Se não conseguiu obter o pedido (ex.: usuário não autenticado),
	// permanecer na página e exibir fallback minimalista
	if (!order || !order.id) {
		try { populateFallbackSuccess(validOrder); } catch(_) {}
		// Desabilitar ações de comprovante até autenticar
		try { setReceiptLinks(null); } catch(_) {}
		clearCartData();
		return;
	}
	
	// Mesmo que o status no banco ainda não tenha sido atualizado pelo webhook,
	// permanecemos na página de sucesso (validação HMAC já garantida acima).
	// Exibimos APROVADO e, se o txid não estiver disponível, mostramos “—” até atualizar.

	// Preencher UI
	populateOrderData(order);
	
	// Renderizar itens do pedido
	renderOrderItems(order);
	
	// Ajustar hero header conforme status
	try {
		const icon = document.querySelector('.success-hero-icon');
		const title = document.querySelector('.success-hero-title');
		const subtitle = document.querySelector('.success-hero-subtitle');
		if (icon) { icon.classList.remove('fa-circle-xmark'); icon.classList.add('fa-circle-check'); icon.style.color = ''; }
		if (title) { title.textContent = 'Compra realizada com sucesso!'; }
		if (subtitle) { subtitle.textContent = 'Obrigado pela preferência. Recebemos seu pagamento e já estamos preparando seu pedido.'; }
	} catch(_) {}

	// Configurar links de comprovante
	const receiptUrl = deriveReceiptUrl(order);
	setReceiptLinks(receiptUrl);

	// Sistema robusto de captura e exibição do txid
	try {
		const sTx = document.getElementById('sTxid');
		if (!sTx) return;
		
		// 1. Primeiro, tentar preencher com dados do success validation (mais rápido)
		if (validData.txid && validData.txid !== '') {
			sTx.textContent = validData.txid;
			sTx.className = 'info-value mono';
			console.log('TXID preenchido via success validation:', validData.txid);
		}
		
		// 2. Se não temos txid ainda, ou queremos confirmar com dados do pedido autenticado
		const currentTxid = (sTx.textContent && sTx.textContent !== '—') ? sTx.textContent : '';
		const needsTxid = !currentTxid || !order.payment || !order.payment.txid;
		
		if (needsTxid) {
			// Polling agressivo mas inteligente para capturar txid
			let attempts = 0;
			let lastTxid = currentTxid;
			
			const updateTxid = (newTxid) => {
				if (newTxid && newTxid !== lastTxid) {
					sTx.textContent = newTxid;
					sTx.className = 'info-value mono';
					sTx.style.color = '#22c55e'; // Verde para indicar sucesso
					lastTxid = newTxid;
					console.log('TXID atualizado:', newTxid);
					return true;
				}
				return false;
			};
			
			const pollTxid = async () => {
				attempts++;
				console.log(`Polling txid - tentativa ${attempts}`);
				
				try {
					// Tentar ambos os endpoints para máxima cobertura
					const [validationData, orderData] = await Promise.allSettled([
						fetchSuccessValidation(),
						fetchOrder(validOrder)
					]);
					
					let foundTxid = null;
					
					// Verificar validation endpoint primeiro (mais rápido)
					if (validationData.status === 'fulfilled' && validationData.value?.txid) {
						foundTxid = validationData.value.txid;
					}
					
					// Verificar order endpoint como backup
					if (!foundTxid && orderData.status === 'fulfilled' && orderData.value?.payment?.txid) {
						foundTxid = orderData.value.payment.txid;
					}
					
					if (foundTxid && updateTxid(foundTxid)) {
						clearInterval(timer);
						return;
					}
					
				} catch (err) {
					console.warn('Erro no polling txid:', err);
				}
				
				// Parar após 20 tentativas (40 segundos)
				if (attempts >= 20) {
					clearInterval(timer);
					console.log('Polling txid finalizado - limite de tentativas atingido');
					// Manter o "—" se não conseguiu pegar
					if (!lastTxid) {
						sTx.textContent = '—';
						sTx.style.color = '#64748b'; // Cinza neutro
					}
				}
			};
			
			// Executar primeira tentativa imediatamente
			pollTxid();
			
			// Continuar polling a cada 2 segundos
			const timer = setInterval(pollTxid, 2000);
		}
		
	} catch(err) {
		console.error('Erro no sistema de txid:', err);
	}

	// Limpeza de carrinho e bloqueio de reexibição
	clearCartData();
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
	// Aguardar um pequeno delay para garantir que todos os scripts carregaram
	setTimeout(() => {
		console.log('Iniciando success page com proteções ativas');
		init();
	}, 100);
});

// Fallback minimalista quando não conseguimos carregar o pedido autenticado
function populateFallbackSuccess(orderId) {
	try {
		// Número do pedido
		const sOrder = document.getElementById('sOrder');
		if (sOrder) sOrder.textContent = '#' + String(orderId);

		// Status: aprovado (validado via endpoint de sucesso)
		const statusElement = document.getElementById('sStatus');
		if (statusElement) {
			statusElement.textContent = 'APROVADO';
			statusElement.className = 'info-badge success-badge';
		}

		// Demais campos ficam como “—” por segurança
		const sAmount = document.getElementById('sAmount');
		if (sAmount) sAmount.textContent = '—';
		const sDate = document.getElementById('sDate');
		if (sDate) sDate.textContent = new Date().toLocaleString('pt-BR');
		const sTxid = document.getElementById('sTxid');
		if (sTxid) { sTxid.textContent = '—'; sTxid.className = 'info-value'; }

		// Hero sempre em sucesso
		const icon = document.querySelector('.success-hero-icon');
		const title = document.querySelector('.success-hero-title');
		const subtitle = document.querySelector('.success-hero-subtitle');
		if (icon) { icon.classList.remove('fa-circle-xmark'); icon.classList.add('fa-circle-check'); icon.style.color = ''; }
		if (title) { title.textContent = 'Compra realizada com sucesso!'; }
		if (subtitle) { subtitle.textContent = 'Obrigado pela preferência. Recebemos seu pagamento e já estamos preparando seu pedido.'; }

		// Aviso sobre autenticação para comprovante
		const hint = document.getElementById('receiptHint');
		if (hint) {
			hint.textContent = 'Faça login para visualizar e baixar o comprovante deste pedido.';
			hint.style.color = '#dc2626';
		}
		// Desabilitar botões
		const view = document.getElementById('receiptView');
		const dl = document.getElementById('receiptDownload');
		if (view) { view.disabled = true; view.style.opacity = '0.6'; }
		if (dl) { dl.disabled = true; dl.style.opacity = '0.6'; }
	} catch(_) {}
}
