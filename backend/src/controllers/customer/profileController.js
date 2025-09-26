// Perfil do cliente - Controlador
const User = require('../../models/User');

class ProfileController {
	// Retorna o perfil do usuário autenticado
	static async obterPerfil(req, res) {
		try {
			// req.usuario é populado pelo middleware autenticarCliente
			return res.json({ sucesso: true, usuario: req.usuario.toJSON() });
		} catch (error) {
			console.error('Erro ao obter perfil:', error);
			return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
		}
	}

	// Atualiza campos básicos do perfil (inclui campos completos de endereço)
	static async atualizarPerfil(req, res) {
		try {
			const permitido = (({ nome, telefone, endereco, numero, bairro, complemento, cidade, estado, cep }) => ({ nome, telefone, endereco, numero, bairro, complemento, cidade, estado, cep }))(req.body || {});
			const usuarioAtualizado = await req.usuario.atualizar(permitido);
			return res.json({ sucesso: true, mensagem: 'Perfil atualizado', usuario: usuarioAtualizado.toJSON() });
		} catch (error) {
			console.error('Erro ao atualizar perfil:', error);
			return res.status(400).json({ sucesso: false, mensagem: error.message || 'Não foi possível atualizar' });
		}
	}

	// Alterar email (exige senha atual para confirmar)
	static async alterarEmail(req, res) {
		try {
			const { novoEmail, senhaAtual } = req.body || {};
			if (!novoEmail || !senhaAtual) {
				return res.status(400).json({ sucesso: false, mensagem: 'Novo email e senha atual são obrigatórios' });
			}

			// Verificar senha
			const ok = await req.usuario.verificarSenha(senhaAtual);
			if (!ok) return res.status(400).json({ sucesso: false, mensagem: 'Senha atual incorreta' });

			// Verificar se email já existe
			const existente = await User.buscarPorEmail(novoEmail);
			if (existente && existente.id !== req.usuario.id) {
				return res.status(409).json({ sucesso: false, mensagem: 'Email já cadastrado por outro usuário' });
			}

			// Atualizar
			const usuarioAtualizado = await req.usuario.atualizar({ email: novoEmail });
			return res.json({ sucesso: true, mensagem: 'Email alterado com sucesso', usuario: usuarioAtualizado.toJSON() });
		} catch (error) {
			console.error('Erro ao alterar email:', error);
			return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
		}
	}

	// Alterar senha (apenas repassa ao método do modelo com verificação)
	static async alterarSenha(req, res) {
		try {
			const { senhaAtual, novaSenha } = req.body || {};
			if (!senhaAtual || !novaSenha) {
				return res.status(400).json({ sucesso: false, mensagem: 'Senha atual e nova senha são obrigatórias' });
			}

			await req.usuario.alterarSenha(senhaAtual, novaSenha);
			return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
		} catch (error) {
			const msg = error.message && /incorreta/i.test(error.message) ? error.message : 'Erro interno do servidor';
			const code = /incorreta/i.test(error.message) ? 400 : 500;
			console.error('Erro ao alterar senha:', error);
			return res.status(code).json({ sucesso: false, mensagem: msg });
		}
	}
}

module.exports = ProfileController;