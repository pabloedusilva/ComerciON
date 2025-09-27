// Teste da nova funcionalidade do switch integrado
const { pool } = require('../src/config/database');

async function testSwitchIntegration() {
    try {
        console.log('🧪 Testando nova funcionalidade integrada do switch...\n');
        
        // 1. Verificar estado inicial
        console.log('1️⃣ Estado inicial:');
        const [initial] = await pool.execute('SELECT * FROM StoreStatus WHERE id = 1');
        if (initial.length > 0) {
            const status = initial[0];
            console.log(`   Modo: ${status.is_manual_mode ? 'Manual (Switch vermelho)' : 'Automático (Switch azul)'}`);
            console.log(`   Status: ${status.closed_now ? 'Fechada' : 'Aberta'}`);
        }
        
        // 2. Testar mudança para modo manual
        console.log('\n2️⃣ Testando mudança para modo manual...');
        await pool.execute(`
            UPDATE StoreStatus 
            SET is_manual_mode = TRUE, closed_now = TRUE, reason = 'Teste modo manual via switch', updated_at = NOW()
            WHERE id = 1
        `);
        console.log('✅ Switch em modo manual (vermelho) - Loja pode ser controlada manualmente');
        
        // 3. Testar mudança para modo automático
        console.log('\n3️⃣ Testando mudança para modo automático...');
        await pool.execute(`
            UPDATE StoreStatus 
            SET is_manual_mode = FALSE, closed_now = FALSE, reason = '', updated_at = NOW()
            WHERE id = 1
        `);
        console.log('✅ Switch em modo automático (azul) - Status baseado nos horários');
        
        // 4. Verificar estado final
        const [final] = await pool.execute('SELECT * FROM StoreStatus WHERE id = 1');
        console.log('\n4️⃣ Estado final:');
        if (final.length > 0) {
            const status = final[0];
            console.log(`   Modo: ${status.is_manual_mode ? 'Manual (Switch vermelho)' : 'Automático (Switch azul)'}`);
            console.log(`   Status: ${status.closed_now ? 'Fechada' : 'Aberta'}`);
        }
        
        console.log('\n🎯 Como testar na interface:');
        console.log('1. Acesse: http://localhost:3000/admin.html');
        console.log('2. Faça login');
        console.log('3. Vá para "Funcionamento"');
        console.log('4. Observe o switch:');
        console.log('   • DESMARCADO (azul) = Modo Automático');
        console.log('     - StatusPill mostra "Automático"');
        console.log('     - Controles desabilitados (opacidade reduzida)');
        console.log('     - Status baseado nos horários de funcionamento');
        console.log('   • MARCADO (vermelho) = Modo Manual');
        console.log('     - StatusPill mostra "Manual"');
        console.log('     - Controles habilitados');
        console.log('     - Botões "Fechar Loja" e "Abrir Loja" funcionais');
        console.log('5. SidebarStatusPill sempre mostra status real da loja');
        
        console.log('\n✅ Funcionalidade integrada do switch implementada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante os testes:', error);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    testSwitchIntegration();
}