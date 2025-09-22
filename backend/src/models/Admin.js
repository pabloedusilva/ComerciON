// Model Admin - Acesso ao dashboard
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { bcryptRounds } = require('../config/environment');

class Admin {
    constructor(data) {
        this.id = data.id;
        this.nome = data.nome;
        this.email = data.email;
        this.senha = data.senha;
        this.nivel_acesso = data.nivel_acesso;
        this.ultimo_login = data.ultimo_login;
        this.tentativas_login = data.tentativas_login;
        this.bloqueado_ate = data.bloqueado_ate;
        this.data_criacao = data.data_criacao;
        this.criado_por = data.criado_por;
        this.ativo = data.ativo;
    }

    // Buscar por email
    static async buscarPorEmail(email) {
        try {
            const query = 'SELECT * FROM admins WHERE email = ? AND ativo = TRUE';
            const [rows] = await pool.execute(query, [email]);
            
            if (rows.length === 0) return null;
            
            return new Admin(rows[0]);
        } catch (error) {
            throw new Error(`Erro ao buscar admin: ${error.message}`);
        }
    }

    // Buscar por ID
    static async buscarPorId(id) {
        try {
            const query = 'SELECT * FROM admins WHERE id = ? AND ativo = TRUE';
            const [rows] = await pool.execute(query, [id]);
            
            if (rows.length === 0) return null;
            
            return new Admin(rows[0]);
        } catch (error) {
            throw new Error(`Erro ao buscar admin por ID: ${error.message}`);
        }
    }

    // Verificar senha
    async verificarSenha(senhaPlana) {
        try {
            return await bcrypt.compare(senhaPlana, this.senha);
        } catch (error) {
            throw new Error('Erro ao verificar senha');
        }
    }

    // Verificar se está bloqueado
    estaBloqueado() {
        if (!this.bloqueado_ate) return false;
        return new Date() < new Date(this.bloqueado_ate);
    }

    // Incrementar tentativas de login
    async incrementarTentativas() {
        try {
            const novasTentativas = this.tentativas_login + 1;
            let bloqueadoAte = null;

            // Bloquear após 5 tentativas por 30 minutos
            if (novasTentativas >= 5) {
                bloqueadoAte = new Date(Date.now() + 30 * 60 * 1000); // 30 min
            }

            const query = `
                UPDATE admins 
                SET tentativas_login = ?, bloqueado_ate = ? 
                WHERE id = ?
            `;
            
            await pool.execute(query, [novasTentativas, bloqueadoAte, this.id]);
            
            this.tentativas_login = novasTentativas;
            this.bloqueado_ate = bloqueadoAte;
        } catch (error) {
            throw new Error(`Erro ao incrementar tentativas: ${error.message}`);
        }
    }

    // Reset tentativas após login bem-sucedido
    async resetTentativas() {
        try {
            const query = `
                UPDATE admins 
                SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login = NOW() 
                WHERE id = ?
            `;
            
            await pool.execute(query, [this.id]);
            
            this.tentativas_login = 0;
            this.bloqueado_ate = null;
            this.ultimo_login = new Date();
        } catch (error) {
            throw new Error(`Erro ao resetar tentativas: ${error.message}`);
        }
    }

    // Criar novo admin (apenas super_admin pode criar)
    static async criar(dados, criadorId) {
        try {
            const { nome, email, senha, nivel_acesso = 'admin' } = dados;
            
            // Verificar se criador é super_admin
            const criador = await Admin.buscarPorId(criadorId);
            if (!criador || criador.nivel_acesso !== 'super_admin') {
                throw new Error('Apenas super admin pode criar novos admins');
            }

            // Verificar se email já existe
            const emailExiste = await Admin.buscarPorEmail(email);
            if (emailExiste) {
                throw new Error('Email já cadastrado');
            }

            // Hash da senha
            const senhaHash = await bcrypt.hash(senha, bcryptRounds);

            const query = `
                INSERT INTO admins (nome, email, senha, nivel_acesso, criado_por)
                VALUES (?, ?, ?, ?, ?)
            `;

            const [resultado] = await pool.execute(query, [
                nome, email, senhaHash, nivel_acesso, criadorId
            ]);

            return await Admin.buscarPorId(resultado.insertId);
        } catch (error) {
            throw new Error(`Erro ao criar admin: ${error.message}`);
        }
    }

    // Alterar senha
    async alterarSenha(senhaAtual, novaSenha) {
        try {
            const senhaValida = await this.verificarSenha(senhaAtual);
            if (!senhaValida) {
                throw new Error('Senha atual incorreta');
            }

            const novaSenhaHash = await bcrypt.hash(novaSenha, bcryptRounds);
            
            const query = 'UPDATE admins SET senha = ? WHERE id = ?';
            await pool.execute(query, [novaSenhaHash, this.id]);

            return true;
        } catch (error) {
            throw new Error(`Erro ao alterar senha: ${error.message}`);
        }
    }

    // Listar todos os admins (apenas super_admin)
    static async listarTodos(solicitanteId) {
        try {
            const solicitante = await Admin.buscarPorId(solicitanteId);
            if (!solicitante || solicitante.nivel_acesso !== 'super_admin') {
                throw new Error('Acesso negado');
            }

            const query = `
                SELECT id, nome, email, nivel_acesso, ultimo_login, data_criacao, ativo 
                FROM admins 
                WHERE ativo = TRUE
                ORDER BY data_criacao DESC
            `;
            
            const [rows] = await pool.execute(query);
            return rows;
        } catch (error) {
            throw new Error(`Erro ao listar admins: ${error.message}`);
        }
    }

    // Desativar admin (apenas super_admin)
    static async desativar(adminId, solicitanteId) {
        try {
            const solicitante = await Admin.buscarPorId(solicitanteId);
            if (!solicitante || solicitante.nivel_acesso !== 'super_admin') {
                throw new Error('Acesso negado');
            }

            // Não pode desativar a si mesmo
            if (adminId === solicitanteId) {
                throw new Error('Não é possível desativar sua própria conta');
            }

            const query = 'UPDATE admins SET ativo = FALSE WHERE id = ?';
            await pool.execute(query, [adminId]);
            
            return true;
        } catch (error) {
            throw new Error(`Erro ao desativar admin: ${error.message}`);
        }
    }

    // Remover dados sensíveis para resposta
    toJSON() {
        const { senha, tentativas_login, bloqueado_ate, ...dadosSeguro } = this;
        return dadosSeguro;
    }
}

module.exports = Admin;