# 🔐 Sistema de Autenticação - Configuração

## ⚠️ INSTRUÇÕES IMPORTANTES

### 1. Configurar variáveis de ambiente

Crie o arquivo `.env` na raiz do projeto backend:

```env
# Banco de dados Railway
DATABASE_URL=mysql://usuario:senha@host:porta/database

# JWT - Use uma chave forte em produção
JWT_SECRET=sua_chave_secreta_super_forte_aqui_123456789
JWT_EXPIRES_IN=24h

# Servidor  
PORT=3000
NODE_ENV=development

# CORS - Adicionar domínio em produção
FRONTEND_URL=http://localhost:5500
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Criar tabelas no banco (EXECUTAR APENAS UMA VEZ)
```bash
npm run criar-tabelas
```

**🚨 CRÍTICO:** Após executar, DELETE o arquivo `criar_tabelas_DELETAR.js` por segurança!

### 4. Iniciar servidor
```bash
# Desenvolvimento
npm run dev

# Produção  
npm start
```

## 🌐 Endpoints de Autenticação

### Cliente (Customer)
- `POST /api/customer/auth/registrar` - Criar conta
- `POST /api/customer/auth/login` - Fazer login
- `POST /api/customer/auth/logout` - Sair
- `GET /api/customer/auth/perfil` - Ver perfil (protegido)
- `PUT /api/customer/auth/perfil` - Editar perfil (protegido)

### Admin (Dashboard)
- `POST /api/admin/auth/login` - Login admin
- `POST /api/admin/auth/logout` - Logout admin
- `GET /api/admin/auth/verificar` - Verificar token (protegido)
- `POST /api/admin/auth/criar-admin` - Criar admin (super admin)
- `GET /api/admin/auth/listar` - Listar admins (super admin)

## 🛡️ Segurança Implementada

✅ Senhas criptografadas (bcrypt 12 rounds)
✅ JWT com expiração
✅ Rate limiting em login  
✅ Validação rigorosa de dados
✅ Proteção CORS
✅ Headers de segurança
✅ Sessões no banco de dados
✅ Middleware de autenticação

## 📱 Integração Frontend

```javascript
// Exemplo: Login do cliente
const response = await fetch('/api/customer/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'cliente@email.com',
        senha: 'minhasenha123'
    })
});

const data = await response.json();
if (data.sucesso) {
    // Salvar token para próximas requisições
    localStorage.setItem('token', data.token);
}
```

## 🎯 Próximos Passos

1. ✅ Configurar .env com dados do Railway
2. ✅ Executar npm install  
3. ✅ Rodar npm run criar-tabelas
4. ⚠️ Deletar criar_tabelas_DELETAR.js
5. ✅ Testar npm run dev
6. 🔄 Integrar com frontend existente