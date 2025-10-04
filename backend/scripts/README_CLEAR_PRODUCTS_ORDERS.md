# Script de Limpeza: Produtos e Pedidos

## ⚠️ AVISO IMPORTANTE

Este script é **DESTRUTIVO** e remove **TODOS** os dados das seguintes tabelas:

- `products` - Todos os produtos cadastrados
- `pedido` - Todos os pedidos realizados  
- `pedido_itens` - Todos os itens dos pedidos
- `reviews` - Todas as avaliações dos clientes
- `payments` - Todos os registros de pagamento

## 📋 Pré-requisitos

- Node.js instalado
- Acesso ao banco de dados configurado
- **Backup dos dados importantes** (altamente recomendado)

## 🚀 Como usar

### Modo Interativo (Recomendado)
```bash
cd backend/scripts
node clear_products_orders.js
```

O script irá:
1. Mostrar o status atual das tabelas
2. Listar o que será removido
3. Pedir confirmação antes de executar

### Modo Automático (para scripts/CI)
```bash
node clear_products_orders.js --confirm
```

⚠️ **Cuidado**: Este modo não pede confirmação!

## 📊 Exemplo de Saída

```
🗑️  Script de Limpeza: Produtos e Pedidos
==================================================
⚠️  Este script irá REMOVER TODOS os dados das seguintes tabelas:
   • reviews (Avaliações dos clientes)
   • payments (Registros de pagamento)
   • pedido_itens (Itens dos pedidos)
   • pedido (Pedidos)
   • products (Produtos)

📊 Status atual das tabelas:
==================================================
reviews         |       15 registros | Avaliações dos clientes
payments        |       42 registros | Registros de pagamento
pedido_itens    |      128 registros | Itens dos pedidos
pedido          |       56 registros | Pedidos
products        |       23 registros | Produtos
==================================================

❓ Tem certeza que deseja continuar?
Digite "sim" para confirmar: sim

🔄 Iniciando limpeza das tabelas...
✅ Tabela 'reviews': 15 registros removidos
✅ Tabela 'payments': 42 registros removidos
✅ Tabela 'pedido_itens': 128 registros removidos
✅ Tabela 'pedido': 56 registros removidos
✅ Tabela 'products': 23 registros removidos

✅ Limpeza concluída com sucesso!
📊 Total de registros removidos: 264
```

## 🛡️ Segurança

### O que o script FAZ:
- ✅ Desabilita temporariamente foreign key checks
- ✅ Remove dados em ordem segura (respeitando relacionamentos)
- ✅ Reseta auto_increment das tabelas
- ✅ Reabilita foreign key checks
- ✅ Mostra contagem de registros removidos
- ✅ Pede confirmação no modo interativo

### O que o script NÃO FAZ:
- ❌ NÃO remove a estrutura das tabelas (apenas os dados)
- ❌ NÃO afeta outras tabelas (usuários, configurações, etc.)
- ❌ NÃO cria backup automaticamente
- ❌ NÃO funciona em modo de produção (se bem configurado)

## 🔧 Troubleshooting

### Erro de Foreign Key
Se aparecer erro relacionado a foreign keys:
```
Error: Cannot delete or update a parent row: a foreign key constraint fails
```

O script deveria lidar com isso automaticamente, mas se persistir:
1. Verifique se há outras tabelas referenciando os dados
2. Execute manualmente: `SET FOREIGN_KEY_CHECKS = 0`

### Erro de Conexão
```
Error: getaddrinfo ENOTFOUND
```
- Verifique as variáveis de ambiente do banco de dados
- Confirme se o banco está acessível

### Tabela não encontrada
```
Table 'database.table_name' doesn't exist
```
- Algumas tabelas podem não existir ainda
- O script ignora automaticamente tabelas inexistentes

## 🚨 Quando usar

### ✅ Situações apropriadas:
- Ambiente de desenvolvimento local
- Limpeza para testes
- Reset de dados de demo
- Preparação para novos testes E2E

### ❌ NÃO usar em:
- Ambiente de produção
- Dados reais de clientes
- Sem fazer backup primeiro
- Se não tem certeza do que está fazendo

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs de erro
2. Confirme a configuração do banco
3. Teste a conectividade primeiro
4. Faça backup antes de tentar novamente

---

**Desenvolvido para o sistema de Pizzaria**  
*Use com responsabilidade! 🍕*