#!/usr/bin/env node

// Script para gerenciar tabelas do Store (Status e Horários)
const { createStoreStatusTable, createStoreHoursTable, dropStoreTables } = require('./store_tables_utils');

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'create':
        console.log('Criando tabelas do Store...');
        await createStoreStatusTable();
        console.log('✓ Tabela StoreStatus criada');
        await createStoreHoursTable();
        console.log('✓ Tabela StoreHours criada');
        console.log('✓ Todas as tabelas foram criadas com sucesso!');
        break;
        
      case 'drop':
        console.log('Removendo tabelas do Store...');
        await dropStoreTables();
        console.log('✓ Tabelas removidas com sucesso!');
        break;
        
      case 'recreate':
        console.log('Recriando tabelas do Store...');
        await dropStoreTables();
        console.log('✓ Tabelas removidas');
        await createStoreStatusTable();
        console.log('✓ Tabela StoreStatus criada');
        await createStoreHoursTable();
        console.log('✓ Tabela StoreHours criada');
        console.log('✓ Todas as tabelas foram recriadas com sucesso!');
        break;
        
      default:
        console.log('Uso: node manage_store_tables.js [create|drop|recreate]');
        console.log('');
        console.log('Comandos:');
        console.log('  create    - Criar tabelas StoreStatus e StoreHours');
        console.log('  drop      - Remover tabelas StoreStatus e StoreHours');
        console.log('  recreate  - Remover e recriar todas as tabelas');
    }
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();