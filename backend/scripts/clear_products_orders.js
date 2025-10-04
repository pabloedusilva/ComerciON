#!/usr/bin/env node

/**
 * Script Removível: Limpar Tabelas de Produtos e Pedidos
 * 
 * Este script remove TODOS os dados das tabelas:
 * - products (produtos)
 * - pedido (pedidos)
 * - pedido_itens (itens dos pedidos)
 * - reviews (avaliações)
 * - payments (pagamentos)
 * 
 * ⚠️  ATENÇÃO: Este script é DESTRUTIVO!
 * ⚠️  Use apenas em ambiente de desenvolvimento!
 * ⚠️  Faça backup antes de executar!
 * 
 * Uso: node clear_products_orders.js [--confirm]
 */

const { pool } = require('../src/config/database');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Lista de tabelas que serão limpas (ordem importante para respeitar foreign keys)
const TABLES_TO_CLEAR = [
    { name: 'reviews', description: 'Avaliações dos clientes' },
    { name: 'payments', description: 'Registros de pagamento' },
    { name: 'pedido_itens', description: 'Itens dos pedidos' },
    { name: 'pedido', description: 'Pedidos' },
    { name: 'products', description: 'Produtos' }
];

async function askConfirmation(message) {
    return new Promise((resolve) => {
        rl.question(message, (answer) => {
            resolve(answer.toLowerCase() === 'sim' || answer.toLowerCase() === 's' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

async function clearTable(tableName) {
    try {
        // Desabilita checagem de foreign key temporariamente
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        // Remove todos os dados da tabela
        const [result] = await pool.execute(`DELETE FROM ${tableName}`);
        
        // Reseta o auto_increment (se aplicável)
        try {
            await pool.execute(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);
        } catch (err) {
            // Ignora erro se a tabela não tiver auto_increment
        }
        
        // Reabilita checagem de foreign key
        await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log(`✅ Tabela '${tableName}': ${result.affectedRows} registros removidos`);
        return result.affectedRows;
    } catch (error) {
        console.error(`❌ Erro ao limpar tabela '${tableName}':`, error.message);
        throw error;
    }
}

async function getTableCount(tableName) {
    try {
        const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        return rows[0].count;
    } catch (error) {
        console.warn(`⚠️  Não foi possível contar registros em '${tableName}': ${error.message}`);
        return 0;
    }
}

async function showTableStatus() {
    console.log('\n📊 Status atual das tabelas:');
    console.log('=' .repeat(50));
    
    for (const table of TABLES_TO_CLEAR) {
        const count = await getTableCount(table.name);
        console.log(`${table.name.padEnd(15)} | ${count.toString().padStart(8)} registros | ${table.description}`);
    }
    console.log('=' .repeat(50));
}

async function main() {
    const args = process.argv.slice(2);
    const autoConfirm = args.includes('--confirm');
    
    console.log('🗑️  Script de Limpeza: Produtos e Pedidos');
    console.log('=' .repeat(50));
    console.log('⚠️  Este script irá REMOVER TODOS os dados das seguintes tabelas:');
    
    TABLES_TO_CLEAR.forEach(table => {
        console.log(`   • ${table.name} (${table.description})`);
    });
    
    console.log('\n⚠️  ESTA AÇÃO NÃO PODE SER DESFEITA!');
    console.log('⚠️  Certifique-se de estar em ambiente de DESENVOLVIMENTO!');
    
    try {
        // Mostra status atual
        await showTableStatus();
        
        // Confirmação
        let confirmed = autoConfirm;
        if (!confirmed) {
            console.log('\n❓ Tem certeza que deseja continuar?');
            confirmed = await askConfirmation('Digite "sim" para confirmar: ');
        }
        
        if (!confirmed) {
            console.log('❌ Operação cancelada pelo usuário.');
            return;
        }
        
        console.log('\n🔄 Iniciando limpeza das tabelas...');
        
        let totalRemoved = 0;
        
        // Limpa cada tabela na ordem correta
        for (const table of TABLES_TO_CLEAR) {
            const removedCount = await clearTable(table.name);
            totalRemoved += removedCount;
        }
        
        console.log('\n✅ Limpeza concluída com sucesso!');
        console.log(`📊 Total de registros removidos: ${totalRemoved}`);
        
        // Mostra status final
        await showTableStatus();
        
    } catch (error) {
        console.error('\n❌ Erro durante a limpeza:', error.message);
        process.exit(1);
    } finally {
        rl.close();
        await pool.end();
    }
}

// Executa o script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = { clearTable, getTableCount };
