// Model User - Clientes da pizzaria
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { bcryptRounds } = require('../config/environment');

class User {
    constructor(data) {
        this.id = data.id;
        this.nome = data.nome;
        this.email = data.email;
        this.senha = data.senha;
        this.telefone = data.telefone;
        this.endereco = data.endereco;
        this.cidade = data.cidade;
        this.estado = data.estado;
        this.cep = data.cep;
        this.data_cadastro = data.data_cadastro;
        this.ativo = data.ativo;
    }

    // Criar novo usuário
    static async criar(dados) {
        try {
            const { nome, email, senha } = dados;
            // Campos opcionais: converter undefined/strings vazias em NULL para o banco
            const norm = (v) => (v == null || (typeof v === 'string' && v.trim() === '') ? null : v);
            const telefone = norm(dados.telefone);
            const endereco = norm(dados.endereco);
            const cidade = norm(dados.cidade);
            const estado = norm(dados.estado);
            const cep = norm(dados.cep);
            
            // Verificar se email já existe
            const emailExiste = await User.buscarPorEmail(email);
            if (emailExiste) {
                throw new Error('Email já cadastrado');
            }

            // Hash da senha
            const senhaHash = await bcrypt.hash(senha, bcryptRounds);

            const query = `
                INSERT INTO usuarios (nome, email, senha, telefone, endereco, cidade, estado, cep, data_cadastro, ativo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), TRUE)
            `;

            const [resultado] = await pool.execute(query, [
                nome, email, senhaHash, telefone, endereco, cidade, estado, cep
            ]);

            return await User.buscarPorId(resultado.insertId);
        } catch (error) {
            throw new Error(`Erro ao criar usuário: ${error.message}`);
        }
    }

    // Buscar por ID
    static async buscarPorId(id) {
        try {
            const query = 'SELECT * FROM usuarios WHERE id = ? AND ativo = TRUE';
            const [rows] = await pool.execute(query, [id]);
            
            if (rows.length === 0) return null;
            
            return new User(rows[0]);
        } catch (error) {
            throw new Error(`Erro ao buscar usuário: ${error.message}`);
        }
    }

    // Buscar por email
    static async buscarPorEmail(email) {
        try {
            const query = 'SELECT * FROM usuarios WHERE email = ? AND ativo = TRUE';
            const [rows] = await pool.execute(query, [email]);
            
            if (rows.length === 0) return null;
            
            return new User(rows[0]);
        } catch (error) {
            throw new Error(`Erro ao buscar usuário por email: ${error.message}`);
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

    // Atualizar dados
    async atualizar(dados) {
        try {
            const campos = [];
            const valores = [];

            // Campos que podem ser atualizados
            if (dados.nome) {
                campos.push('nome = ?');
                valores.push(dados.nome);
            }
            if (dados.telefone) {
                campos.push('telefone = ?');
                valores.push(dados.telefone);
            }
            if (dados.endereco) {
                campos.push('endereco = ?');
                valores.push(dados.endereco);
            }
            if (dados.cidade) {
                campos.push('cidade = ?');
                valores.push(dados.cidade);
            }
            if (dados.estado) {
                campos.push('estado = ?');
                valores.push(dados.estado);
            }
            if (dados.cep) {
                campos.push('cep = ?');
                valores.push(dados.cep);
            }

            if (campos.length === 0) {
                throw new Error('Nenhum campo para atualizar');
            }

            valores.push(this.id);

            const query = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`;
            await pool.execute(query, valores);

            return await User.buscarPorId(this.id);
        } catch (error) {
            throw new Error(`Erro ao atualizar usuário: ${error.message}`);
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
            
            const query = 'UPDATE usuarios SET senha = ? WHERE id = ?';
            await pool.execute(query, [novaSenhaHash, this.id]);

            return true;
        } catch (error) {
            throw new Error(`Erro ao alterar senha: ${error.message}`);
        }
    }

    // Desativar conta
    async desativar() {
        try {
            const query = 'UPDATE usuarios SET ativo = FALSE WHERE id = ?';
            await pool.execute(query, [this.id]);
            return true;
        } catch (error) {
            throw new Error(`Erro ao desativar usuário: ${error.message}`);
        }
    }

    // Remover dados sensíveis para resposta
    toJSON() {
        const { senha, ...dadosSeguro } = this;
        return dadosSeguro;
    }
}

module.exports = User;