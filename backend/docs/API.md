# Documentação da API
# Pizzaria Backend

## Endpoints disponíveis:

### Público
- GET /api/public/catalog - Catálogo produtos
- GET /api/public/store/status - Status loja

### Cliente
- POST /api/customer/auth/register - Cadastro
- POST /api/customer/auth/login - Login
- GET /api/customer/orders - Meus pedidos

### Admin
- POST /api/admin/auth/login - Login admin
- GET /api/admin/dashboard/stats - Estatísticas
- CRUD /api/admin/products - Gestão produtos