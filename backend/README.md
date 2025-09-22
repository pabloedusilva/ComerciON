# Pizzaria Backend API

Backend Node.js completo para sistema de pizzaria com funcionalidades avançadas.

## 🚀 Tecnologias

- **Node.js** + **Express.js**
- **MySQL** (Railway Database)
- **Redis** (Cache/Sessões)
- **Socket.IO** (Real-time)
- **JWT** (Autenticação)
- **Cloudinary** (Upload imagens)

## 🏗️ Arquitetura

```
src/
├── config/          # Configurações (DB, Redis, etc.)
├── controllers/     # Lógica de negócio
├── models/          # Modelos de dados
├── routes/          # Rotas da API
├── middleware/      # Middlewares
├── services/        # Serviços externos
├── utils/           # Utilitários
├── database/        # (sem migrations/seeders no código)
└── sockets/         # Socket.IO
```

## 🔧 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Iniciar em desenvolvimento
npm run dev
```

## 📋 Scripts

- `npm start` - Produção
- `npm run dev` - Desenvolvimento
- (removidos) scripts de teste, migrations e seeders do código-fonte

## 🔐 Autenticação

Sistema JWT com níveis de acesso:
- **Público** - Catálogo, status loja
- **Cliente** - Pedidos, perfil
- **Admin** - Gestão completa

## 📱 Socket.IO

Events em tempo real:
- `new_order` - Novo pedido
- `order_status` - Status atualizado
- `store_status` - Loja aberta/fechada

## 💳 Pagamentos

Integração Infinity Pay:
- PIX instantâneo
- Cartão de crédito/débito
- Webhooks automáticos

## 📞 Notificações

- WhatsApp Business API
- E-mail (Nodemailer)
- SMS (opcional)

## 🗄️ Banco de Dados

MySQL com tabelas principais:
- users (clientes/admins)
- products (pizzas/bebidas)
- orders (pedidos)
- order_items (itens)
- reviews (avaliações)

## 🚦 Deploy

```bash
# PM2 (Produção)
pm2 start ecosystem.config.js

# Railway/Heroku
git push origin main
```

---

Esta estrutura garante **escalabilidade**, **segurança** e **manutenibilidade** para o crescimento futuro da aplicação! 🎯