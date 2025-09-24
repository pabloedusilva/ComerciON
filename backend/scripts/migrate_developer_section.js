/*
    Migration para implementar a seção de desenvolvedor
    - Cria tabela de admins se não existir
    - Adiciona campo super_admin 
    - Cria tabela de logs do sistema
    - Cria tabela de system_status para monitoramento
*/

const { pool } = require('../src/config/database');

async function ensureAdminsTable() {
    // Verificar se a tabela já existe
    const [tables] = await pool.query("SHOW TABLES LIKE 'admins'");
    
    if (tables.length === 0) {
        // Criar tabela nova
        await pool.query(`
            CREATE TABLE \`admins\` (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                senha VARCHAR(255) NOT NULL,
                nivel_acesso ENUM('admin', 'super_admin') DEFAULT 'admin',
                super_admin TINYINT(1) DEFAULT 0,
                ultimo_login DATETIME NULL,
                tentativas_login INT DEFAULT 0,
                bloqueado_ate DATETIME NULL,
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                criado_por INT NULL,
                ativo TINYINT(1) DEFAULT 1,
                INDEX idx_email (email),
                INDEX idx_nivel_acesso (nivel_acesso),
                INDEX idx_super_admin (super_admin),
                FOREIGN KEY (criado_por) REFERENCES admins(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✔ Tabela admins criada');
    } else {
        // Verificar se os campos necessários existem
        const [columns] = await pool.query("SHOW COLUMNS FROM admins LIKE 'super_admin'");
        
        if (columns.length === 0) {
            // Adicionar campo super_admin
            await pool.query(`
                ALTER TABLE admins 
                ADD COLUMN super_admin TINYINT(1) DEFAULT 0 AFTER nivel_acesso,
                ADD INDEX idx_super_admin (super_admin)
            `);
            console.log('✔ Campo super_admin adicionado à tabela admins');
        }
        
        // Verificar se nivel_acesso tem o enum correto
        const [nivelAcessoColumn] = await pool.query(`
            SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'admins' 
            AND COLUMN_NAME = 'nivel_acesso'
        `);
        
        if (nivelAcessoColumn.length > 0 && !nivelAcessoColumn[0].COLUMN_TYPE.includes('super_admin')) {
            await pool.query(`
                ALTER TABLE admins 
                MODIFY COLUMN nivel_acesso ENUM('admin', 'super_admin') DEFAULT 'admin'
            `);
            console.log('✔ Enum nivel_acesso atualizado');
        }
        
        console.log('✔ Tabela admins verificada e atualizada');
    }
}

async function ensureSystemLogsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS \`system_logs\` (
            id INT PRIMARY KEY AUTO_INCREMENT,
            level ENUM('debug', 'info', 'warn', 'error', 'fatal') NOT NULL DEFAULT 'info',
            message TEXT NOT NULL,
            metadata JSON NULL,
            source VARCHAR(255) NULL,
            admin_id INT NULL,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (level),
            INDEX idx_created_at (created_at),
            INDEX idx_source (source),
            INDEX idx_admin_id (admin_id),
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✔ Tabela system_logs criada');
}

async function ensureSystemStatusTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS \`system_status\` (
            id INT PRIMARY KEY AUTO_INCREMENT,
            component VARCHAR(100) NOT NULL,
            status ENUM('online', 'offline', 'degraded', 'maintenance') NOT NULL,
            message TEXT NULL,
            metadata JSON NULL,
            last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_component (component),
            INDEX idx_status (status),
            INDEX idx_last_check (last_check)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✔ Tabela system_status criada');
}

async function ensureSessionsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS \`sessoes\` (
            id INT PRIMARY KEY AUTO_INCREMENT,
            token_hash VARCHAR(255) NOT NULL,
            admin_id INT NULL,
            user_id INT NULL,
            tipo_usuario ENUM('admin', 'customer') NOT NULL,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            expira_em DATETIME NOT NULL,
            ativo TINYINT(1) DEFAULT 1,
            INDEX idx_token_hash (token_hash),
            INDEX idx_admin_id (admin_id),
            INDEX idx_user_id (user_id),
            INDEX idx_expira_em (expira_em),
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✔ Tabela sessoes criada/verificada');
}

async function insertDefaultSuperAdmin() {
    const bcrypt = require('bcrypt');
    
    // Verificar se já existe um super admin
    const [existing] = await pool.query(
        'SELECT id FROM admins WHERE super_admin = 1 LIMIT 1'
    );
    
    if (existing.length === 0) {
        // Criar super admin padrão (você deve alterar essa senha imediatamente)
        const senhaHash = await bcrypt.hash('SuperAdmin@2025!', 12);
        
        await pool.query(`
            INSERT INTO admins (nome, email, senha, nivel_acesso, super_admin, data_criacao) 
            VALUES (?, ?, ?, 'super_admin', 1, NOW())
        `, ['Super Admin', 'superadmin@pizzaria.com', senhaHash]);
        
        console.log('🔐 Super admin padrão criado');
        console.log('   Email: superadmin@pizzaria.com');
        console.log('   Senha: SuperAdmin@2025!');
        console.log('   ⚠️  ALTERE ESTA SENHA IMEDIATAMENTE!');
    } else {
        console.log('• Super admin já existe');
    }
}

async function insertDefaultSystemStatus() {
    const components = [
        { component: 'database', status: 'online', message: 'Database connection active' },
        { component: 'server', status: 'online', message: 'Server running' },
        { component: 'payment_api', status: 'offline', message: 'Payment API not configured' },
        { component: 'email_service', status: 'offline', message: 'Email service not configured' }
    ];
    
    for (const comp of components) {
        await pool.query(`
            INSERT INTO system_status (component, status, message) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                status = VALUES(status), 
                message = VALUES(message),
                updated_at = NOW()
        `, [comp.component, comp.status, comp.message]);
    }
    
    console.log('✔ Status padrão dos componentes inserido');
}

async function main() {
    try {
        console.log('🚀 Iniciando migração da seção de desenvolvedor...\n');
        
        await ensureAdminsTable();
        await ensureSessionsTable();
        await ensureSystemLogsTable();
        await ensureSystemStatusTable();
        await insertDefaultSuperAdmin();
        await insertDefaultSystemStatus();
        
        console.log('\n✅ Migração da seção de desenvolvedor concluída com sucesso!');
        console.log('\n🔐 IMPORTANTE: Acesse o sistema e altere a senha do super admin imediatamente!');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na migração:', err);
        process.exit(1);
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { main };