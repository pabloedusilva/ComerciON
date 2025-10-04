#!/usr/bin/env node

/**
 * Script Utilitário: Limpar Tabelas Seletivamente
 * 
 * Permite limpar tabelas individuais ou grupos específicos
 * 
 * Uso: 
 * - node clear_selective.js products
 * - node clear_selective.js orders  
 * - node clear_selective.js reviews
 * - node clear_selective.js all
 */

const { pool } = require('../src/config/database');

const TABLE_GROUPS = {
    products: [
        { name: 'products', description: 'Produtos' }
    ],
    orders: [
        { name: 'payments', description: 'Registros de pagamento' },
        { name: 'pedido_itens', description: 'Itens dos pedidos' },
        { name: 'pedido', description: 'Pedidos' }
    ],
    reviews: [
        { name: 'reviews', description: 'Avaliações dos clientes' }
    ],
    all: [
        { name: 'reviews', description: 'Avaliações dos clientes' },
        { name: 'payments', description: 'Registros de pagamento' },
        { name: 'pedido_itens', description: 'Itens dos pedidos' },
        { name: 'pedido', description: 'Pedidos' },
        { name: 'products', description: 'Produtos' }
    ]
};

async function clearTable(tableName) {
    try {
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
        const [result] = await pool.execute(`DELETE FROM ${tableName}`);
        
        try {
            await pool.execute(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);
        } catch (err) {
            // Ignora se não tiver auto_increment
        }
        
        await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log(`✅ ${tableName}: ${result.affectedRows} registros removidos`);
        return result.affectedRows;
    } catch (error) {
        console.error(`❌ Erro em '${tableName}':`, error.message);
        return 0;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const target = args[0];
    
    if (!target || !TABLE_GROUPS[target]) {
        console.log('❌ Uso: node clear_selective.js <target>');
        console.log('\nOpções disponíveis:');
        Object.keys(TABLE_GROUPS).forEach(key => {
            console.log(`  • ${key}: ${TABLE_GROUPS[key].map(t => t.name).join(', ')}`);
        });
        process.exit(1);
    }
    
    const tablesToClear = TABLE_GROUPS[target];
    console.log(`🗑️  Limpando: ${target}`);
    
    let total = 0;
    for (const table of tablesToClear) {
        total += await clearTable(table.name);
    }
    
    console.log(`✅ Total removido: ${total} registros`);
    await pool.end();
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Erro:', error);
        process.exit(1);
    });
}