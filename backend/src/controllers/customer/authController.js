// Controller de Autenticação - Cliente
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const { pool } = require('../../config/database');
const { jwtSecret, jwtExpiresIn, loginAttemptWindowMs, loginAttemptMax, loginLockMinutes, maxActiveSessionsPerUser } = require('../../config/environment');

class AuthController {
    static async registrarTentativaLogin(email, ip, sucesso) {
        try {
            await pool.execute(
                `INSERT INTO login_attempts (email, ip_address, sucesso, criado_em) VALUES (?, ?, ?, NOW())`,
                [email, ip, sucesso ? 1 : 0]
            );
        } catch (_) { /* silencioso */ }
    }

    static async estaBloqueado(email, ip) {
        try {
            // conta falhas recentes por email e por IP
            const [rowsEmail] = await pool.execute(
                `SELECT COUNT(*) as falhas FROM login_attempts 
                 WHERE email = ? AND sucesso = 0 AND criado_em > (NOW() - INTERVAL ? SECOND)`,
                [email, Math.floor(loginAttemptWindowMs / 1000)]
            );
            const [rowsIP] = await pool.execute(
                `SELECT COUNT(*) as falhas FROM login_attempts 
                 WHERE ip_address = ? AND sucesso = 0 AND criado_em > (NOW() - INTERVAL ? SECOND)`,
                [ip, Math.floor(loginAttemptWindowMs / 1000)]
            );
            const falhas = Math.max(rowsEmail[0]?.falhas || 0, rowsIP[0]?.falhas || 0);
            return falhas >= loginAttemptMax;
        } catch (_) { return false; }
    }

    static async limparTentativas(email, ip) {
        try {
            await pool.execute(
                `DELETE FROM login_attempts WHERE (email = ? OR ip_address = ?)`,
                [email, ip]
            );
        } catch (_) {}
    }
    // Registro de novo cliente
    static async registrar(req, res) {
        try {
            const { nome, email, senha, telefone, endereco, numero, bairro, complemento, cidade, estado, cep } = req.body;

            // Criar usuário
            const novoUsuario = await User.criar({
                nome,
                email,
                senha,
                telefone,
                endereco,
                numero,
                bairro,
                complemento,
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

            // Checar bloqueio
            const bloqueado = await AuthController.estaBloqueado(email, req.ip);
            if (bloqueado) {
                return res.status(429).json({
                    sucesso: false,
                    mensagem: `Muitas tentativas. Tente novamente em ${loginLockMinutes} minutos.`
                });
            }

            // Buscar usuário
            const usuario = await User.buscarPorEmail(email);
            if (!usuario) {
                await AuthController.registrarTentativaLogin(email, req.ip, false);
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Email ou senha incorretos'
                });
            }

            // Verificar senha
            const senhaValida = await usuario.verificarSenha(senha);
            if (!senhaValida) {
                await AuthController.registrarTentativaLogin(email, req.ip, false);
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Email ou senha incorretos'
                });
            }

            // Limpar tentativas após sucesso
            await AuthController.registrarTentativaLogin(email, req.ip, true);
            await AuthController.limparTentativas(email, req.ip);

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

            // Limitar sessões ativas por usuário
            const [sessAtivas] = await pool.execute(
                `SELECT id FROM sessoes WHERE user_id = ? AND tipo_usuario = 'customer' AND expira_em > NOW() AND ativo = TRUE ORDER BY criado_em ASC`,
                [usuario.id]
            );
            if (Array.isArray(sessAtivas) && sessAtivas.length >= maxActiveSessionsPerUser) {
                const excedente = sessAtivas.length - maxActiveSessionsPerUser + 1; // remover as mais antigas até caber a nova
                const idsRemover = sessAtivas.slice(0, excedente).map(s => s.id);
                if (idsRemover.length) {
                    await pool.query(`DELETE FROM sessoes WHERE id IN (${idsRemover.map(() => '?').join(',')})`, idsRemover);
                }
            }

            const ua = (req.get('User-Agent') || '').slice(0, 300);
            await pool.execute(
                `INSERT INTO sessoes (user_id, tipo_usuario, token_hash, ip_address, user_agent, expira_em) VALUES (?, 'customer', ?, ?, ?, ?)`,
                [usuario.id, tokenHash, req.ip, ua, expiraEm]
            );

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
            const { nome, telefone, endereco, numero, bairro, complemento, cidade, estado, cep } = req.body;

            const usuarioAtualizado = await req.usuario.atualizar({
                nome,
                telefone,
                endereco,
                numero,
                bairro,
                complemento,
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

            // Invalida todas as sessões deste usuário após alterar a senha
            await pool.execute(`DELETE FROM sessoes WHERE user_id = ? AND tipo_usuario = 'customer'`, [req.usuario.id]);

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