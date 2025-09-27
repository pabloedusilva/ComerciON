// Script para adicionar campo is_manual_mode na tabela StoreStatus
const { pool } = require('../src/config/database');

async function addManualModeField() {
    try {
        console.log('🔧 Adicionando campo is_manual_mode na tabela StoreStatus...');
        
        // Verificar se o campo já existe
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'StoreStatus' 
            AND COLUMN_NAME = 'is_manual_mode'
        `);
        
        if (columns.length > 0) {
            console.log('✅ Campo is_manual_mode já existe na tabela StoreStatus');
        } else {
            // Adicionar o campo
            await pool.execute(`
                ALTER TABLE StoreStatus 
                ADD COLUMN is_manual_mode BOOLEAN DEFAULT FALSE AFTER notify_email
            `);
            console.log('✅ Campo is_manual_mode adicionado com sucesso!');
        }
        
        // Verificar estrutura atual da tabela
        const [structure] = await pool.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'StoreStatus' 
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('\n📋 Estrutura atual da tabela StoreStatus:');
        console.table(structure);
        
    } catch (error) {
        console.error('❌ Erro ao adicionar campo:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    addManualModeField();
}