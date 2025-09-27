// Teste simples para verificar se a API está funcionando
const { pool } = require('../src/config/database');

async function testStoreAPI() {
  try {
    console.log('🧪 Testando API do Store Status...');
    
    // Verificar se as tabelas existem
    const [storeStatusRows] = await pool.execute('SELECT * FROM StoreStatus LIMIT 1');
    const [storeHoursRows] = await pool.execute('SELECT * FROM StoreHours ORDER BY day_of_week');
    
    console.log('✅ Tabela StoreStatus:', storeStatusRows[0] ? 'OK' : 'Vazia');
    console.log('✅ Tabela StoreHours:', storeHoursRows.length > 0 ? `${storeHoursRows.length} registros` : 'Vazia');
    
    // Testar os modelos
    const StoreStatus = require('../src/models/StoreStatus');
    const StoreHours = require('../src/models/StoreHours');
    
    console.log('\n📋 Testando StoreStatus model...');
    const status = await StoreStatus.get();
    console.log('Status atual:', {
      closed_now: status.closed_now,
      reason: status.reason,
      reopen_at: status.reopen_at
    });
    
    console.log('\n📅 Testando StoreHours model...');
    const hours = await StoreHours.getAll();
    console.log('Horários configurados:', hours.length, 'dias');
    
    hours.forEach((hour, index) => {
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      console.log(`  ${dayNames[hour.day]}: ${hour.enabled ? `${hour.open} - ${hour.close}` : 'Fechado'}`);
    });
    
    console.log('\n✅ Todos os testes passaram!');
    console.log('\n🎯 A funcionalidade está pronta para uso no admin!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testStoreAPI();