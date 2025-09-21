# 🔧 CORREÇÃO: Rate Limiting Ajustado para Desenvolvimento

## ❌ **Problema Identificado:**
```json
{
  "sucesso": false,
  "mensagem": "Muitas tentativas. Tente novamente em 15 minutos."
}
```

**Causa:** Rate limiting muito restritivo durante desenvolvimento, bloqueando testes normais.

## ✅ **Soluções Aplicadas:**

### 1. **Rate Limiting Inteligente**
- **🟢 Desenvolvimento:** Limites muito mais permissivos
- **🔴 Produção:** Limites rigorosos mantidos

### 2. **Configurações Ajustadas:**

| Limite | Desenvolvimento | Produção |
|--------|----------------|----------|
| **Geral** | 1000 req/min | 100 req/15min |
| **Login** | 50 tentativas/5min | 5 tentativas/15min |
| **Admin** | 30 tentativas/5min | 3 tentativas/15min |
| **Cadastro** | 20 cadastros/10min | 3 cadastros/1hora |

### 3. **Endpoint de Reset (Desenvolvimento)**
- **URL:** `POST /api/dev/reset-rate-limit`
- **Função:** Reseta contadores de rate limit
- **Disponível:** Apenas em desenvolvimento

## 🧪 **Como Testar Agora:**

### **Opção 1: Página de Teste**
1. Acesse: http://localhost:3000/teste-auth.html
2. Clique em **"Resetar Rate Limit"** se der erro
3. Teste todos os endpoints normalmente

### **Opção 2: Comandos diretos**
```bash
# Resetar rate limit
curl -X POST http://localhost:3000/api/dev/reset-rate-limit

# Testar health
curl http://localhost:3000/api/health

# Testar login admin
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pizzaria.com","senha":"admin123456"}'
```

## 🔐 **Credenciais para Teste:**

### **Admin:**
- **Email:** admin@pizzaria.com
- **Senha:** admin123456

### **Cliente (registrar novo):**
- **Nome:** João Silva
- **Email:** joao@email.com
- **Senha:** senha123
- **Telefone:** (11) 99999-9999

## 🚀 **Status Atual:**
- ✅ Servidor rodando em: http://localhost:3000
- ✅ Rate limiting ajustado para desenvolvimento
- ✅ Botão de reset disponível na página de teste
- ✅ Todos os endpoints funcionando
- ✅ Banco Railway conectado

## 📝 **Próximos Passos:**
1. **Teste todos os endpoints** na página de teste
2. **Use o botão "Resetar Rate Limit"** se aparecer erro de limite
3. **Registre um cliente** e teste login
4. **Teste login admin** com credenciais fornecidas

---

**⚠️ IMPORTANTE:** Em produção, os limites voltam a ser rigorosos automaticamente!