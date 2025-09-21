// Controller de Autenticação - Cliente
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const { pool } = require('../../config/database');
const { jwtSecret, jwtExpiresIn } = require('../../config/environment');

class AuthController {
    // Registro de novo cliente
    static async registrar(req, res) {
        try {
            const { nome, email, senha, telefone, endereco, cidade, estado, cep } = req.body;

            // Criar usuário
            const novoUsuario = await User.criar({
                nome,
                email,
                senha,
                telefone,
                endereco,
                cidade,
                estado,
                cep
            });

            res.status(201).json({
                sucesso: true,
                mensagem: 'Conta criada com sucesso',
                usuario: novoUsuario.toJSON()
            });

        } catch (error) {
            console.error('Erro no registro:', error);
            
            if (error.message.includes('Email já cadastrado')) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Este email já está cadastrado'
                });
            }

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Login de cliente
    static async login(req, res) {
        try {
            const { email, senha } = req.body;

            // Buscar usuário
            const usuario = await User.buscarPorEmail(email);
            if (!usuario) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Email ou senha incorretos'
                });
            }

            // Verificar senha
            const senhaValida = await usuario.verificarSenha(senha);
            if (!senhaValida) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Email ou senha incorretos'
                });
            }

            // Gerar token JWT
            const token = jwt.sign(
                { 
                    id: usuario.id, 
                    email: usuario.email,
                    tipo: 'cliente'
                },
                jwtSecret,
                { expiresIn: jwtExpiresIn }
            );

            // Salvar sessão no banco para segurança
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

            const query = `
                INSERT INTO sessoes (usuario_id, tipo_usuario, token_hash, ip_address, user_agent, expira_em)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            await pool.execute(query, [
                usuario.id,
                'cliente',
                tokenHash,
                req.ip,
                req.get('User-Agent'),
                expiraEm
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Login realizado com sucesso',
                token,
                usuario: usuario.toJSON()
            });

        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Logout
    static async logout(req, res) {
        try {
            // Middleware de auth já remove a sessão
            res.json({
                sucesso: true,
                mensagem: 'Logout realizado com sucesso'
            });
        } catch (error) {
            console.error('Erro no logout:', error);
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Verificar se token é válido
    static async verificarToken(req, res) {
        try {
            // Se chegou até aqui, o token é válido (middleware verificou)
            res.json({
                sucesso: true,
                usuario: req.usuario.toJSON()
            });
        } catch (error) {
            console.error('Erro na verificação:', error);
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Atualizar perfil
    static async atualizarPerfil(req, res) {
        try {
            const { nome, telefone, endereco, cidade, estado, cep } = req.body;

            const usuarioAtualizado = await req.usuario.atualizar({
                nome,
                telefone,
                endereco,
                cidade,
                estado,
                cep
            });

            res.json({
                sucesso: true,
                mensagem: 'Perfil atualizado com sucesso',
                usuario: usuarioAtualizado.toJSON()
            });

        } catch (error) {
            console.error('Erro na atualização:', error);
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Alterar senha
    static async alterarSenha(req, res) {
        try {
            const { senhaAtual, novaSenha } = req.body;

            await req.usuario.alterarSenha(senhaAtual, novaSenha);

            res.json({
                sucesso: true,
                mensagem: 'Senha alterada com sucesso'
            });

        } catch (error) {
            console.error('Erro na alteração de senha:', error);
            
            if (error.message.includes('Senha atual incorreta')) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Senha atual incorreta'
                });
            }

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = AuthController;