#!/usr/bin/env node

// Script para limpar dados JSON corrompidos nas tabelas system_logs e system_status
const { pool } = require('../src/config/database');

async function limparDadosCorrempidos() {
    console.log('🧹 Iniciando limpeza de dados corrompidos...');
    
    try {
        // Conectar ao banco
        console.log('📦 Conectando ao banco de dados...');
        
        // Limpar metadata corrompida em system_logs
        console.log('🔧 Limpando metadata corrompida em system_logs...');
        await pool.execute(`
            UPDATE system_logs 
            SET metadata = NULL 
            WHERE metadata IS NOT NULL 
            AND (
                metadata = '[object Object]'
                OR metadata = ''
                OR LENGTH(metadata) < 2
                OR (metadata NOT LIKE '{%}' AND metadata NOT LIKE '[%]')
            )
        `);
        
        // Limpar metadata corrompida em system_status
        console.log('🔧 Limpando metadata corrompida em system_status...');
        await pool.execute(`
            UPDATE system_status 
            SET metadata = NULL 
            WHERE metadata IS NOT NULL 
            AND (
                metadata = '[object Object]'
                OR metadata = ''
                OR LENGTH(metadata) < 2
                OR (metadata NOT LIKE '{%}' AND metadata NOT LIKE '[%]')
            )
        `);
        
        // Verificar dados após limpeza
        const [logsCount] = await pool.execute('SELECT COUNT(*) as count FROM system_logs WHERE metadata IS NOT NULL');
        const [statusCount] = await pool.execute('SELECT COUNT(*) as count FROM system_status WHERE metadata IS NOT NULL');
        
        console.log(`✅ Limpeza concluída!`);
        console.log(`📊 Logs com metadata válida: ${logsCount[0].count}`);
        console.log(`📊 Status com metadata válida: ${statusCount[0].count}`);
        
    } catch (error) {
        console.error('❌ Erro durante a limpeza:', error);
        throw error;
    } finally {
        // Fechar conexão
        await pool.end();
        console.log('🔌 Conexão com banco fechada');
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    limparDadosCorrempidos()
        .then(() => {
            console.log('🎉 Limpeza executada com sucesso!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Falha na limpeza:', error);
            process.exit(1);
        });
}

module.exports = { limparDadosCorrempidos };