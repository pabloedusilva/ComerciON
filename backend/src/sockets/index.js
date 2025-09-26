const { Server } = require('socket.io');
const { jwtSecret, strictSessionUA, strictSessionIP } = require('../config/environment');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');

async function validateAdminToken(token, socket) {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, jwtSecret);
    // Conferir sessão na tabela sessoes
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      `SELECT * FROM sessoes WHERE token_hash = ? AND expira_em > NOW() AND ativo = TRUE`,
      [tokenHash]
    );
    if (!rows.length) return null;
    const sessao = rows[0];
    if (sessao.tipo_usuario !== 'admin') return null;

    // Validar fingerprint básica (UA/IP) quando aplicável
    const ua = socket.handshake.headers['user-agent'] || '';
    if (strictSessionUA && sessao.user_agent && ua && sessao.user_agent !== ua.slice(0, 300)) {
      return null;
    }
    if (strictSessionIP && sessao.ip_address) {
      // Em proxies, o IP pode variar; validação simples
      const ip = socket.handshake.address;
      if (ip && ip !== sessao.ip_address) return null;
    }

    return { adminId: sessao.admin_id, sessaoId: sessao.id };
  } catch (e) {
    return null;
  }
}

function setupAdminNamespace(io) {
  const nsp = io.of('/admin');
  nsp.use(async (socket, next) => {
    // Aceitar token via auth ou query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const auth = await validateAdminToken(token, socket);
    if (!auth) return next(new Error('unauthorized'));
    socket.data.admin = auth;
    next();
  });

  nsp.on('connection', (socket) => {
    // Opcional: registrar conexão
    // console.log('Admin conectado via WS', socket.id);

    socket.on('disconnect', () => {
      // console.log('Admin desconectado', socket.id);
    });
  });

  return nsp;
}

function setupSockets(server) {
  const io = new Server(server, {
    cors: { origin: true, credentials: true }
  });

  const admin = setupAdminNamespace(io);

  // Namespace cliente simples (sem autenticação forte ainda — pode evoluir para validar token JWT)
  const cliente = io.of('/cliente');
  cliente.on('connection', (socket) => {
    // Futuro: validar token JWT do cliente se necessário
  });

  // Expor métodos prontos para emitir
  io.emitOrderCreated = (payload) => {
    admin.emit('order:created', payload);
    admin.emit('dashboard:update');
    cliente.emit('order:created', payload);
  };
  io.emitOrderUpdated = (payload) => {
    admin.emit('order:updated', payload);
    admin.emit('dashboard:update');
    cliente.emit('order:updated', payload);
  };

  return io;
}

module.exports = { setupSockets };
