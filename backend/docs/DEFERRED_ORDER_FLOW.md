## Fluxo Diferido de Contagem de Pedidos

Desde esta alteração, um pedido criado pelo cliente (status inicial `pendente`) NÃO é mais contado em dashboards, relatórios ou métricas até que o pagamento seja aprovado.

### Motivo
Evitamos inflar contagens e receita com pedidos abandonados antes do pagamento. Só após confirmação (webhook ou retorno seguro) o pedido passa para `preparando` e então é emitido em tempo real para os administradores.

### Resumo do Fluxo
1. Cliente envia itens -> POST /api/customer/orders cria registro com `status=pendente` e NÃO emite socket `order:created`.
2. Frontend chama POST /api/customer/payment/infinitepay/checkout-link usando o `id` retornado.
3. Cliente paga no provedor.
4. Webhook (/api/customer/payment/infinitepay/webhook) recebe confirmação e:
   - Registra/atualiza pagamento em `payments`.
   - Se era `pendente` e pagamento aprovado, atualiza para `preparando`.
   - Emite agora `order:created` (evento diferido) para painéis/admin.
5. Dashboards e relatórios ignoram `pendente` e `cancelado` em cálculos de receita/pedidos.

### Impacto em Consultas
Consultas de métricas foram atualizadas para adicionar filtro `status NOT IN ('cancelado','pendente')` sempre que a intenção é contar pedidos pagos/ativos.

### Segurança
O valor do pedido é recalculado no backend no momento da criação (antes do pagamento). O webhook valida que o `amount` corresponde ao total registrado. Fraudes de alteração de preço no frontend não surtem efeito.

### Próximos Passos Sugeridos
- Adicionar coluna/campo de expiração para pedidos `pendente` abandonados e limpá-los periodicamente.
- Implementar assinatura HMAC do corpo do webhook (se o provedor suportar) ou migração para opção com assinatura forte.
- Adicionar testes automatizados cobrindo transição `pendente` -> `preparando` -> `a_caminho` -> `entregue`.

---
Documento gerado automaticamente para explicar a mudança de arquitetura do fluxo de pedidos.