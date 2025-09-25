(() => {
	// Early auth gate to avoid flashing content for guests
	if (!window.AuthSystem?.isAuthenticated?.()) {
		const current = window.location.pathname + window.location.search + window.location.hash;
		window.location.href = '/login?redirect=' + encodeURIComponent(current || '/perfil');
		return;
	}
	const token = window.AuthSystem?.token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
	const alertBox = document.getElementById('profile-alert');

	const api = async (url, options={}) => {
		const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
		if (token) headers['Authorization'] = `Bearer ${token}`;
		const res = await fetch(url, { ...options, headers });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.mensagem || 'Erro de rede');
		return data;
	};

	const showAlert = (msg, type='success') => {
		if (!alertBox) return;
		alertBox.className = `alert ${type === 'success' ? 'alert-success' : 'alert-error'}`;
		alertBox.textContent = msg;
		alertBox.classList.remove('hidden');
		setTimeout(() => { alertBox.classList.add('hidden'); }, 4000);
	};

	const els = {
		nome: document.getElementById('nome'),
		telefone: document.getElementById('telefone'),
		email: document.getElementById('email'),
		endereco: document.getElementById('endereco'),
		cidade: document.getElementById('cidade'),
		estado: document.getElementById('estado'),
		cep: document.getElementById('cep'),
		btnSalvar: document.getElementById('btn-salvar'),
		novoEmail: document.getElementById('novo-email'),
		senhaConfirmarEmail: document.getElementById('senha-confirmar-email'),
		btnAlterarEmail: document.getElementById('btn-alterar-email'),
		senhaAtual: document.getElementById('senha-atual'),
		novaSenha: document.getElementById('nova-senha'),
		confirmarSenha: document.getElementById('confirmar-senha'),
		btnAlterarSenha: document.getElementById('btn-alterar-senha')
	};

	// Carregar dados do perfil com proteção
	const carregarPerfil = async () => {
		try {
			const data = await api('/api/customer/profile');
			const u = data.usuario || {};
			els.nome.value = u.nome || '';
			els.telefone.value = u.telefone || '';
			els.email.value = u.email || '';
			els.endereco.value = u.endereco || '';
			els.cidade.value = u.cidade || '';
			els.estado.value = u.estado || '';
			els.cep.value = u.cep || '';
		} catch (e) {
			// Se token inválido, redireciona para login
			window.AuthSystem?.removeToken?.();
			window.AuthSystem?.removeUser?.();
			window.location.href = '/login?redirect=/perfil';
		}
	};

	const salvarBasico = async () => {
		try {
			const payload = {
				nome: els.nome.value.trim(),
				telefone: els.telefone.value.trim(),
				endereco: els.endereco.value.trim(),
				cidade: els.cidade.value.trim(),
				estado: els.estado.value.trim().toUpperCase(),
				cep: els.cep.value.trim()
			};
			const data = await api('/api/customer/profile', { method: 'PUT', body: JSON.stringify(payload) });
			showAlert(data.mensagem || 'Dados atualizados');
		} catch (e) {
			showAlert(e.message || 'Erro ao salvar', 'error');
		}
	};

	const alterarEmail = async () => {
		try {
			const payload = { novoEmail: els.novoEmail.value.trim(), senhaAtual: els.senhaConfirmarEmail.value };
			if (!payload.novoEmail || !payload.senhaAtual) return showAlert('Preencha novo email e senha atual', 'error');
			const data = await api('/api/customer/profile/email', { method: 'PUT', body: JSON.stringify(payload) });
			showAlert(data.mensagem || 'Email alterado');
			els.email.value = payload.novoEmail;
			els.novoEmail.value = '';
			els.senhaConfirmarEmail.value = '';
		} catch (e) {
			showAlert(e.message || 'Erro ao alterar email', 'error');
		}
	};

	const alterarSenha = async () => {
		try {
			if (els.novaSenha.value !== els.confirmarSenha.value) return showAlert('Confirmação de senha não confere', 'error');
			const payload = { senhaAtual: els.senhaAtual.value, novaSenha: els.novaSenha.value };
			if (!payload.senhaAtual || !payload.novaSenha) return showAlert('Preencha senha atual e nova', 'error');
			const data = await api('/api/customer/profile/senha', { method: 'PUT', body: JSON.stringify(payload) });
			showAlert(data.mensagem || 'Senha alterada');
			els.senhaAtual.value = els.novaSenha.value = els.confirmarSenha.value = '';
			// Por segurança, realizar logout forçado após troca de senha
			setTimeout(() => {
				try { window.AuthSystem?.logout?.(); } catch(_) {}
			}, 1200);
		} catch (e) {
			showAlert(e.message || 'Erro ao alterar senha', 'error');
		}
	};

	// Eventos
	if (els.btnSalvar) els.btnSalvar.addEventListener('click', (ev) => { ev.preventDefault(); salvarBasico(); });
	if (els.btnAlterarEmail) els.btnAlterarEmail.addEventListener('click', (ev) => { ev.preventDefault(); alterarEmail(); });
	if (els.btnAlterarSenha) els.btnAlterarSenha.addEventListener('click', (ev) => { ev.preventDefault(); alterarSenha(); });

	// Boot
	carregarPerfil();
})();
