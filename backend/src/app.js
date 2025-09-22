// Carregar variáveis de ambiente primeiro
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Aplicação principal Express
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { testConnection } = require('./config/database');
const routes = require('./routes');
const { limiteGeral } = require('./middleware/rateLimit');

const app = express();

// Middlewares de segurança
app.use(helmet({
    crossOriginEmbedderPolicy: false, // Para permitir iframes se necessário
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'", 
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            scriptSrc: [
                "'self'",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net"
            ],
            // Permitir atributos inline como onclick, sem liberar blocos <script> inline
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"]
        },
    },
}));

// CORS - permitir requisições do frontend
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://seudominio.com'] // Substitua pelo seu domínio em produção
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting geral
app.use(limiteGeral);

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Trust proxy (importante para Railway)
app.set('trust proxy', 1);

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../../frontend')));
// Servir uploads públicos (mesma pasta usada pelo uploadService: backend/public/uploads)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Rotas da API
app.use('/api', routes);

// Rotas para páginas - URLs sem .html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/pages/index.html'));
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/pages/index.html'));
});

app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/pages/menu.html'));
});

app.get('/sobre', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/pages/sobre.html'));
});

app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/pages/customer/cadastro.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/pages/customer/login.html'));
});

// Rotas Admin
app.get('/admin-login', (req, res) => {
    // Evitar cache para impedir voltar após logout
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, '../../frontend/pages/admin/admin-login.html'));
});

app.get('/admin', async (req, res) => {
    // Verificar se tem token de admin válido
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.query.token || 
                  req.cookies?.admin_token ||
                  req.get('Cookie')?.split(';').find(c => c.trim().startsWith('admin_token='))?.split('=')[1];

    // Se não tem token, redirecionar para login
    if (!token) {
        // Evitar cache para impedir voltar após logout
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.redirect('/admin-login');
    }

    // Se tem token, verificar se é válido (opcional - pode ser feito via JavaScript)
    // Evitar cache da página protegida
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, '../../frontend/pages/admin/admin.html'));
});

app.get('/dashboard', async (req, res) => {
    // Redirecionar dashboard para /admin
    res.redirect('/admin');
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro:', error);
    
    // Não expor detalhes do erro em produção
    const mensagem = process.env.NODE_ENV === 'production' 
        ? 'Erro interno do servidor' 
        : error.message;

    res.status(error.status || 500).json({
        sucesso: false,
        mensagem
    });
});

// 404 para rotas não encontradas
app.use('*', (req, res) => {
    // Se for requisição de API, retornar JSON
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({
            sucesso: false,
            mensagem: 'Endpoint não encontrado'
        });
    }
    
    // Para outras rotas, redirecionar para 404.html ou home
    res.status(404).sendFile(path.join(__dirname, '../../frontend/pages/index.html'));
});

// Testar conexão com banco ao inicializar
testConnection().then(conectado => {
    if (conectado) {
        console.log('✅ Aplicação pronta para uso');
    } else {
        console.log('❌ Problema na conexão com banco');
    }
});

module.exports = app;