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
const StoreStatus = require('./models/StoreStatus');
const StoreHours = require('./models/StoreHours');

function parseTimeToMinutes(t) {
    if (!t || typeof t !== 'string') return null;
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
    return hh * 60 + mm;
}
function isWithinWindow(nowMin, openMin, closeMin) {
    if (openMin == null || closeMin == null) return false;
    if (openMin === closeMin) return false;
    if (closeMin > openMin) {
        return nowMin >= openMin && nowMin < closeMin;
    } else {
        return nowMin >= openMin || nowMin < closeMin;
    }
}
async function isStoreOpenNow() {
    try {
        const [status, hours] = await Promise.all([StoreStatus.get(), StoreHours.getAll()]);
        if (status && status.closed_now) return false;
        if (!status || status.is_manual_mode === false) {
            const now = new Date();
            const dow = now.getDay();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const today = (hours || []).find(h => Number(h.day) === dow);
            if (!today || !today.enabled) return false;
            const openMin = parseTimeToMinutes(today.open);
            const closeMin = parseTimeToMinutes(today.close);
            return isWithinWindow(nowMin, openMin, closeMin);
        }
        return true;
    } catch (_) {
        // Em dúvida, negar acesso às páginas protegidas
        return false;
    }
}

// Responder quando a loja estiver fechada (extremamente restritivo)
function respondClosed(req, res) {
    // Nunca permita cache dessas respostas
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const accept = String(req.headers['accept'] || '');
    // Para navegadores (HTML), redirecionar de forma amigável para o menu com sinalizador
    if (accept.includes('text/html') || req.method === 'GET' || req.method === 'HEAD') {
        return res.redirect(302, '/menu?closed=1');
    }
    // Para chamadas não-HTML, retornar 403 explícito
    return res.status(403).json({ sucesso: false, codigo: 'STORE_CLOSED', mensagem: 'Estabelecimento fechado no momento.' });
}

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
            // Permitir conexões WebSocket para atualizações em tempo real
            connectSrc: ["'self'", "https:", "wss:", "ws:"]
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

// Guardar acesso às páginas protegidas antes de servir estáticos (caminhos diretos ou alias)
app.use(async (req, res, next) => {
    try {
        const p = (req.path || '').toLowerCase();
        const isRestricted = (
            p === '/checkout' ||
            p === '/payment' ||
            p.endsWith('/pages/customer/checkout.html') ||
            p.endsWith('/pages/customer/payment.html')
        );
        if (!isRestricted) return next();
        const open = await isStoreOpenNow();
        if (!open) return respondClosed(req, res);
        return next();
    } catch (_) {
        // Em caso de erro, negar acesso por segurança
        return respondClosed(req, res);
    }
});

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

// Checkout & Payment pages (extensionless)
app.get('/checkout', async (req, res) => {
    const open = await isStoreOpenNow();
    if (!open) return respondClosed(req, res);
    res.sendFile(path.join(__dirname, '../../frontend/pages/customer/checkout.html'));
});

app.get('/payment', async (req, res) => {
    const open = await isStoreOpenNow();
    if (!open) return respondClosed(req, res);
    res.sendFile(path.join(__dirname, '../../frontend/pages/customer/payment.html'));
});
  
    app.get('/pedidos', (req, res) => {
        res.sendFile(path.join(__dirname, '../../frontend/pages/customer/pedidos.html'));
    });

// Páginas do cliente (URLs sem .html)
app.get('/perfil', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/pages/customer/perfil.html'));
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

// Rota /developer removida - Agora é uma seção integrada no painel admin

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