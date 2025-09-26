# Pizzaria Backend API

Backend Node.js completo para sistema de pizzaria com funcionalidades avançadas.

## 🚀 Tecnologias

- **Node.js** + **Express.js**
- **MySQL** (Railway Database)
- **Socket.IO** (Real-time)
- **JWT** (Autenticação)
- **Cloudinary** (Upload imagens)

## 🏗️ Arquitetura

```
src/
├── config/          # Configurações (DB, Cloudinary, etc.)
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

### Banco de dados (local/dev)

- Criar tabelas base e registros mínimos:
	- Via Node: execute `node scripts/seed.js`
	- Isso garante a existência de `Layout` (id=1), `Settings` (id=1) e `delivery_areas`
	- Não cria pedidos (orders); as estatísticas de entrega ficarão vazias até existirem pedidos entregues

- Testar estatísticas de entregas (somente leitura):
	- `node scripts/test_delivery_stats.js`
	- O retorno vazio indica ausência de pedidos entregues no momento

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

### 📢 Avaliações (Reviews)

O sistema de avaliações permite que cada cliente deixe **uma avaliação por pedido entregue**.

Estrutura da tabela `reviews`:
```
id INT PK AI
user_id INT (FK usuarios.id)
order_id INT (FK pedido.id)
product_id INT NULL (reservado p/ futuras avaliações por item)
rating TINYINT (1-5)
comment TEXT NULL
verified TINYINT(1) DEFAULT 0 (futuro uso moderação)
created_at / updated_at
UNIQUE (user_id, order_id)
```

Criação manual da tabela (idempotente):
```
node backend/scripts/create_reviews_table.js
```

Endpoints:
Cliente:
- POST `/api/customer/reviews`  { order_id, rating, comment? }
- GET  `/api/customer/reviews`  (lista avaliações do usuário)

Admin:
- GET `/api/admin/reviews?q=&rating=&limit=&offset=`
- DELETE `/api/admin/reviews/:id` (opcional – moderação)

Regras de negócio:
- Apenas pedidos com status `entregue` podem ser avaliados.
- Uma avaliação por pedido.
- `rating` fora de 1..5 é ajustado.
- Comentário sanitizado (tags HTML removidas via middleware global).

Frontend Admin:
- Seção de avaliações agora consome API real (`/api/admin/reviews`) – filtros de busca e rating funcionam.
- Média exibida vem do backend (AVG rating global).

Frontend Cliente:
- Página de pedidos permite avaliar pedidos entregues através de modal interativo.

Relatórios:
- Controller de relatórios já inclui `avaliacao_media` baseado em `AVG(rating)` quando tabela existir.

## 🚦 Deploy

```bash
# PM2 (Produção)
pm2 start ecosystem.config.js

# Railway/Heroku
git push origin main
```

---

Esta estrutura garante **escalabilidade**, **segurança** e **manutenibilidade** para o crescimento futuro da aplicação! 🎯