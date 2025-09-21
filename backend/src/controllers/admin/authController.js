// Controller de Autenticação - Admin
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../../models/Admin');
const { pool } = require('../../config/database');
const { jwtSecret, jwtExpiresIn } = require('../../config/environment');

class AdminAuthController {
    // Login de admin
    static async login(req, res) {
        try {
            const { email, senha } = req.body;

            // Buscar admin
            const admin = await Admin.buscarPorEmail(email);
            if (!admin) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Email ou senha incorretos'
                });
            }

            // Verificar se está bloqueado
            if (admin.estaBloqueado()) {
                return res.status(423).json({
                    sucesso: false,
                    mensagem: 'Conta temporariamente bloqueada devido a muitas tentativas. Tente novamente em 30 minutos.'
                });
            }

            // Verificar senha
            const senhaValida = await admin.verificarSenha(senha);
            if (!senhaValida) {
                // Incrementar tentativas de login
                await admin.incrementarTentativas();
                
                const tentativasRestantes = 5 - admin.tentativas_login;
                if (tentativasRestantes <= 0) {
                    return res.status(423).json({
                        sucesso: false,
                        mensagem: 'Conta bloqueada por 30 minutos devido a muitas tentativas incorretas'
                    });
                }

                return res.status(401).json({
                    sucesso: false,
                    mensagem: `Email ou senha incorretos. ${tentativasRestantes} tentativas restantes.`
                });
            }

            // Reset tentativas após login bem-sucedido
            await admin.resetTentativas();

            // Gerar token JWT
            const token = jwt.sign(
                { 
                    id: admin.id, 
                    email: admin.email,
                    tipo: 'admin',
                    nivel: admin.nivel_acesso
                },
                jwtSecret,
                { expiresIn: jwtExpiresIn }
            );

            // Salvar sessão no banco
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

            const query = `
                INSERT INTO sessoes (admin_id, tipo_usuario, token_hash, ip_address, user_agent, expira_em)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            await pool.execute(query, [
                admin.id,
                'admin',
                tokenHash,
                req.ip,
                req.get('User-Agent'),
                expiraEm
            ]);

            // Log de acesso para auditoria
            console.log(`🔐 Admin login: ${admin.email} - IP: ${req.ip} - ${new Date().toISOString()}`);

            // Definir cookie admin_token
            res.cookie('admin_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 horas
            });

            res.json({
                sucesso: true,
                mensagem: 'Login admin realizado com sucesso',
                token,
                admin: admin.toJSON()
            });

        } catch (error) {
            console.error('Erro no login admin:', error);
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Logout admin
    static async logout(req, res) {
        try {
            // Invalidar token no banco (marcar sessão como inválida)
            const tokenHash = crypto.createHash('sha256').update(req.headers.authorization?.replace('Bearer ', '') || '').digest('hex');
            
            const query = `
                UPDATE sessoes 
                SET expira_em = NOW(), ativo = FALSE 
                WHERE token_hash = ? AND admin_id = ? AND tipo_usuario = 'admin'
            `;
            
            await pool.execute(query, [tokenHash, req.usuario.id]);

            // Limpar cookie admin_token
            res.clearCookie('admin_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });

            // Log de logout para auditoria
            console.log(`🔓 Admin logout: ${req.usuario.email} - IP: ${req.ip} - ${new Date().toISOString()}`);

            res.json({
                sucesso: true,
                mensagem: 'Logout admin realizado com sucesso'
            });
        } catch (error) {
            console.error('Erro no logout admin:', error);
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Verificar se token admin é válido
    static async verificarToken(req, res) {
        try {
            res.json({
                sucesso: true,
                admin: req.usuario.toJSON()
            });
        } catch (error) {
            console.error('Erro na verificação admin:', error);
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Criar novo admin (apenas super_admin)
    static async criarAdmin(req, res) {
        try {
            const { nome, email, senha, nivel_acesso } = req.body;

            const novoAdmin = await Admin.criar({
                nome,
                email,
                senha,
                nivel_acesso
            }, req.usuario.id);

            // Log para auditoria
            console.log(`👤 Novo admin criado: ${email} por ${req.usuario.email} - ${new Date().toISOString()}`);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Admin criado com sucesso',
                admin: novoAdmin.toJSON()
            });

        } catch (error) {
            console.error('Erro ao criar admin:', error);
            
            if (error.message.includes('Apenas super admin')) {
                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Acesso negado'
                });
            }

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

    // Alterar senha admin
    static async alterarSenha(req, res) {
        try {
            const { senhaAtual, novaSenha } = req.body;

            await req.usuario.alterarSenha(senhaAtual, novaSenha);

            // Log para auditoria
            console.log(`🔑 Senha alterada: ${req.usuario.email} - IP: ${req.ip} - ${new Date().toISOString()}`);

            res.json({
                sucesso: true,
                mensagem: 'Senha alterada com sucesso'
            });

        } catch (error) {
            console.error('Erro na alteração de senha admin:', error);
            
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

    // Listar admins (apenas super_admin)
    static async listarAdmins(req, res) {
        try {
            const admins = await Admin.listarTodos(req.usuario.id);

            res.json({
                sucesso: true,
                admins
            });

        } catch (error) {
            console.error('Erro ao listar admins:', error);
            
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Acesso negado'
                });
            }

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }

    // Desativar admin (apenas super_admin)
    static async desativarAdmin(req, res) {
        try {
            const { adminId } = req.params;

            await Admin.desativar(parseInt(adminId), req.usuario.id);

            // Log para auditoria
            console.log(`❌ Admin desativado: ID ${adminId} por ${req.usuario.email} - ${new Date().toISOString()}`);

            res.json({
                sucesso: true,
                mensagem: 'Admin desativado com sucesso'
            });

        } catch (error) {
            console.error('Erro ao desativar admin:', error);
            
            if (error.message.includes('Acesso negado')) {
                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Acesso negado'
                });
            }

            if (error.message.includes('Não é possível desativar')) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Não é possível desativar sua própria conta'
                });
            }

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = AdminAuthController;