# 🏗️ ESTRUTURA COMPLETA - BACKEND NODE.JS PIZZARIA

## 📋 ANÁLISE DO FRONTEND ATUAL

### 🎯 Funcionalidades Identificadas:

#### **👥 ÁREA DO CLIENTE:**
- ✅ Catálogo de produtos (pizzas/bebidas)
- ✅ Carrinho de compras com personalização
- ✅ Sistema de autenticação (login/cadastro)
- ✅ Checkout e finalização de pedidos
- ✅ Avaliações e feedback
- ✅ Status da loja (aberto/fechado)

#### **🔧 ÁREA ADMINISTRATIVA:**
- ✅ Dashboard com métricas e gráficos
- ✅ Gestão de produtos (CRUD)
- ✅ Gestão de pedidos (status dinâmico)
- ✅ Gestão de clientes
- ✅ Relatórios e análises
- ✅ Avaliações e reviews
- ✅ Configurações da loja
- ✅ Gestão de entregas e áreas
- ✅ Layout e customização
- ✅ Funcionamento (horários/status)

---

## 🚀 ESTRUTURA DO BACKEND

```
backend/
│
├── 📁 src/
│   ├── 📁 config/
│   │   ├── database.js              # Configuração MySQL Railway
│   │   ├── cloudinary.js            # Upload de imagens
│   │   └── environment.js           # Variáveis de ambiente
│   │
│   ├── 📁 controllers/
│   │   ├── 📁 admin/
│   │   │   ├── authController.js    # Login admin
│   │   │   ├── dashboardController.js
│   │   │   ├── productsController.js
│   │   │   ├── ordersController.js
│   │   │   ├── customersController.js
│   │   │   ├── reportsController.js
│   │   │   ├── reviewsController.js
│   │   │   ├── settingsController.js
│   │   │   ├── deliveryController.js
│   │   │   └── layoutController.js
│   │   │
│   │   ├── 📁 customer/
│   │   │   ├── authController.js    # Login/cadastro cliente
│   │   │   ├── productsController.js
│   │   │   ├── cartController.js
│   │   │   ├── ordersController.js
│   │   │   ├── reviewsController.js
│   │   │   └── profileController.js
│   │   │
│   │   └── 📁 public/
│   │       ├── storeController.js   # Status da loja
│   │       └── catalogController.js # Catálogo público
│   │
│   ├── 📁 models/
│   │   ├── User.js                  # Clientes e admins
│   │   ├── Product.js               # Pizzas e bebidas
│   │   ├── Category.js              # Categorias
│   │   ├── Order.js                 # Pedidos
│   │   ├── OrderItem.js             # Itens do pedido
│   │   ├── Review.js                # Avaliações
│   │   ├── DeliveryArea.js          # Áreas de entrega
│   │   ├── StoreSettings.js         # Configurações
│   │   ├── Payment.js               # Pagamentos
│   │   └── Notification.js          # Notificações
│   │
│   ├── 📁 routes/
│   │   ├── 📁 admin/
│   │   │   ├── index.js             # Rotas admin principais
│   │   │   ├── auth.js              # /api/admin/auth
│   │   │   ├── dashboard.js         # /api/admin/dashboard
│   │   │   ├── products.js          # /api/admin/products
│   │   │   ├── orders.js            # /api/admin/orders
│   │   │   ├── customers.js         # /api/admin/customers
│   │   │   ├── reports.js           # /api/admin/reports
│   │   │   ├── reviews.js           # /api/admin/reviews
│   │   │   ├── settings.js          # /api/admin/settings
│   │   │   ├── delivery.js          # /api/admin/delivery
│   │   │   └── layout.js            # /api/admin/layout
│   │   │
│   │   ├── 📁 customer/
│   │   │   ├── index.js
│   │   │   ├── auth.js              # /api/customer/auth
│   │   │   ├── products.js          # /api/customer/products
│   │   │   ├── cart.js              # /api/customer/cart
│   │   │   ├── orders.js            # /api/customer/orders
│   │   │   ├── reviews.js           # /api/customer/reviews
│   │   │   └── profile.js           # /api/customer/profile
│   │   │
│   │   ├── 📁 public/
│   │   │   ├── catalog.js           # /api/public/catalog
│   │   │   └── store.js             # /api/public/store
│   │   │
│   │   └── index.js                 # Router principal
│   │
│   ├── 📁 middleware/
│   │   ├── auth.js                  # Autenticação JWT
│   │   ├── adminAuth.js             # Autorização admin
│   │   ├── validation.js            # Validação de dados
│   │   ├── rateLimit.js             # Rate limiting
│   │   ├── upload.js                # Upload de arquivos
│   │   ├── cors.js                  # CORS customizado
│   │   ├── logger.js                # Logs de requisições
│   │   └── errorHandler.js          # Tratamento de erros
│   │
│   ├── 📁 services/
│   │   ├── 📁 payment/
│   │   │   ├── infinityPayService.js # Integração Infinity Pay
│   │   │   ├── pixService.js         # PIX
│   │   │   └── creditCardService.js  # Cartão
│   │   │
│   │   ├── 📁 notification/
│   │   │   ├── whatsappService.js    # API WhatsApp
│   │   │   ├── emailService.js       # E-mail (Nodemailer)
│   │   │   └── smsService.js         # SMS (opcional)
│   │   │
│   │   ├── 📁 external/
│   │   │   ├── cepService.js         # ViaCEP API
│   │   │   ├── locationService.js    # Google Maps
│   │   │   └── statesCitiesService.js # IBGE API
│   │   │
│   │   ├── authService.js            # Lógica de autenticação
│   │   ├── orderService.js           # Processamento pedidos
│   │   ├── reportService.js          # Geração relatórios
│   │   └── uploadService.js          # Upload imagens
│   │
│   ├── 📁 utils/
│   │   ├── constants.js              # Constantes
│   │   ├── helpers.js                # Funções auxiliares
│   │   ├── validators.js             # Validadores custom
│   │   ├── logger.js                 # Sistema de logs
│   │   ├── encryption.js             # Criptografia
│   │   └── dateUtils.js              # Utilitários de data
│   │
│   ├── 📁 database/
│   │   └── connection.js             # Conexão MySQL (sem migrations/seeders no repositório)
│   │
│   ├── 📁 sockets/
│   │   ├── adminSocket.js            # Socket.IO admin
│   │   ├── customerSocket.js         # Socket.IO cliente
│   │   └── orderSocket.js            # Atualizações pedidos
│   │
│   └── app.js                        # Aplicação principal
│
├── 📁 public/
│   ├── 📁 uploads/
│   │   ├── products/                 # Imagens produtos
│   │   ├── banners/                  # Banners carousel
│   │   └── logos/                    # Logos da loja
│   │
│   └── 📁 temp/                      # Arquivos temporários
│
├── 📁 tests/                          # (removido do repositório)
│
├── 📁 docs/
│   ├── API.md                        # Documentação API
│   ├── DEPLOYMENT.md                 # Deploy
│   └── SECURITY.md                   # Segurança
│
├── 📁 scripts/
│   └── backup.js                     # Backup DB
│
├── .env.example                      # Exemplo variáveis
├── .gitignore
├── package.json
├── package-lock.json
├── server.js                         # Entry point
├── ecosystem.config.js               # PM2 config
└── README.md
```

---

## 🔧 TECNOLOGIAS E DEPENDÊNCIAS

### **📦 Principais:**
- **Node.js** + **Express.js**
- **MySQL** (Railway Database)
- **Socket.IO** (Real-time)
- **JWT** (Autenticação)
- **Bcrypt** (Hash senhas)

### **🔌 Integrações:**
- **Infinity Pay API** (Pagamentos)
- **WhatsApp Business API**
- **Cloudinary** (Upload imagens)
- **Nodemailer** (E-mails)
- **ViaCEP** (Endereços)
- **Google Maps API**

### **🛡️ Segurança:**
- **Helmet** (Headers segurança)
- **Express-rate-limit** (Rate limiting)
- **CORS** (Cross-origin)
- **Express-validator** (Validação)
- **XSS-Clean** (XSS Protection)

---

## 🗄️ ESTRUTURA DO BANCO (MySQL)

### **Principais Tabelas:**

```sql
-- Usuários (clientes e admins)
users (id, name, email, password, phone, role, created_at, updated_at)

-- Produtos
products (id, name, description, category_id, images, prices, sizes, active)

-- Pedidos
orders (id, user_id, total, status, delivery_address, payment_method, created_at)

-- Itens do pedido
order_items (id, order_id, product_id, quantity, price, size, customizations)

-- Avaliações
reviews (id, user_id, order_id, product_id, rating, comment, verified)

-- Áreas de entrega
delivery_areas (id, state, city, fee, active)

-- Configurações da loja
store_settings (id, key, value, updated_at)
```

---

## 🚦 ROTAS DA API

### **🔓 Públicas:**
- `GET /api/public/catalog` - Catálogo produtos
- `GET /api/public/store/status` - Status loja
- `GET /api/public/store/settings` - Configurações públicas

### **👤 Cliente:**
- `POST /api/customer/auth/register` - Cadastro
- `POST /api/customer/auth/login` - Login
- `GET /api/customer/orders` - Meus pedidos
- `POST /api/customer/orders` - Criar pedido
- `POST /api/customer/reviews` - Avaliar

### **🔧 Admin:**
- `POST /api/admin/auth/login` - Login admin
- `GET /api/admin/dashboard/stats` - Estatísticas
- `CRUD /api/admin/products` - Gestão produtos
- `GET /api/admin/orders` - Todos pedidos
- `PUT /api/admin/orders/:id/status` - Atualizar status

---

## 🔐 SISTEMA DE AUTENTICAÇÃO

### **Níveis de Acesso:**
1. **Público** - Catálogo, status loja
2. **Cliente** - Pedidos, perfil, avaliações
3. **Admin** - Gestão completa

### **JWT Tokens:**
- **Access Token** (15min)
- **Refresh Token** (7 dias)
- **Roles**: `customer`, `admin`, `super_admin`

---

## 💳 SISTEMA DE PAGAMENTOS

### **Infinity Pay Integration:**
- **PIX** (Instantâneo)
- **Cartão de Crédito**
- **Cartão de Débito**
- **Webhooks** para status

### **Fluxo de Pagamento:**
1. Cliente finaliza pedido
2. Gera cobrança Infinity Pay
3. Cliente paga
4. Webhook confirma
5. Pedido vai para preparação

---

## 📱 NOTIFICAÇÕES REAL-TIME

### **Socket.IO Events:**
- `new_order` - Novo pedido (Admin)
- `order_status` - Status atualizado (Cliente)
- `store_status` - Loja aberta/fechada

### **WhatsApp Integration:**
- Confirmação de pedido
- Atualizações de status
- Notificações de entrega

---

## 🚀 PRÓXIMOS PASSOS

1. **Setup inicial** do projeto Node.js
2. **Configuração** do banco MySQL Railway
3. **Implementação** das rotas básicas
4. **Integração** Infinity Pay
5. **Sistema** de autenticação
6. **Real-time** com Socket.IO
7. **Deploy** e testes

---

Esta estrutura garante **escalabilidade**, **segurança** e **manutenibilidade** para o crescimento futuro da aplicação! 🎯