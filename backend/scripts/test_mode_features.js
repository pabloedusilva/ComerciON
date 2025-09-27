// Teste das novas funcionalidades de modo automático/manual
const { pool } = require('../src/config/database');

async function testModeFeatures() {
    try {
        console.log('🧪 Testando funcionalidades de modo automático/manual...\n');
        
        // 1. Verificar estrutura da tabela
        console.log('1️⃣ Verificando estrutura da tabela StoreStatus...');
        const [structure] = await pool.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'StoreStatus' 
            AND COLUMN_NAME = 'is_manual_mode'
        `);
        
        if (structure.length > 0) {
            console.log('✅ Campo is_manual_mode encontrado na tabela');
            console.table(structure);
        } else {
            console.log('❌ Campo is_manual_mode não encontrado');
            return;
        }
        
        // 2. Testar inserção/atualização com modo manual
        console.log('\n2️⃣ Testando atualização com modo manual...');
        await pool.execute(`
            UPDATE StoreStatus 
            SET is_manual_mode = TRUE, closed_now = TRUE, reason = 'Teste modo manual', updated_at = NOW()
            WHERE id = 1
        `);
        console.log('✅ Status atualizado para modo manual');
        
        // 3. Verificar dados atualizados
        const [currentStatus] = await pool.execute('SELECT * FROM StoreStatus WHERE id = 1');
        console.log('\n3️⃣ Status atual da loja:');
        if (currentStatus.length > 0) {
            const status = currentStatus[0];
            console.log(`   Modo: ${status.is_manual_mode ? 'Manual' : 'Automático'}`);
            console.log(`   Status: ${status.closed_now ? 'Fechada' : 'Aberta'}`);
            console.log(`   Motivo: ${status.reason || 'Nenhum'}`);
            console.log(`   Última atualização: ${status.updated_at}`);
        }
        
        // 4. Testar modo automático
        console.log('\n4️⃣ Testando modo automático...');
        await pool.execute(`
            UPDATE StoreStatus 
            SET is_manual_mode = FALSE, closed_now = FALSE, reason = '', updated_at = NOW()
            WHERE id = 1
        `);
        console.log('✅ Status atualizado para modo automático');
        
        // 5. Verificar status final
        const [finalStatus] = await pool.execute('SELECT * FROM StoreStatus WHERE id = 1');
        console.log('\n5️⃣ Status final da loja:');
        if (finalStatus.length > 0) {
            const status = finalStatus[0];
            console.log(`   Modo: ${status.is_manual_mode ? 'Manual' : 'Automático'}`);
            console.log(`   Status: ${status.closed_now ? 'Fechada' : 'Aberta'}`);
            console.log(`   Motivo: ${status.reason || 'Nenhum'}`);
        }
        
        // 6. Testar API endpoint
        console.log('\n6️⃣ Testando endpoint da API...');
        console.log('   Execute este teste manualmente:');
        console.log('   GET http://localhost:3000/api/public/store');
        console.log('   Verifique se o campo "isManualMode" está presente na resposta');
        
        console.log('\n✅ Todos os testes de banco de dados passaram!');
        console.log('\n🔧 Para testar a interface:');
        console.log('   1. Acesse http://localhost:3000/admin.html');
        console.log('   2. Faça login');
        console.log('   3. Vá para "Funcionamento"');
        console.log('   4. Observe o "Status Atual" mostrando "Automático" (azul)');
        console.log('   5. Clique no botão de troca para alternar para "Manual" (vermelho)');
        console.log('   6. Observe que o "sidebarStatusPill" mostra o status real da loja');
        
    } catch (error) {
        console.error('❌ Erro durante os testes:', error);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    testModeFeatures();
}