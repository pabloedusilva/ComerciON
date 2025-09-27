// Middleware: bloqueia criação de pedidos quando a loja está fechada
const StoreStatus = require('../models/StoreStatus');
const StoreHours = require('../models/StoreHours');

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
  if (openMin === closeMin) return false; // janela zero => fechado
  if (closeMin > openMin) {
    // mesma madrugada
    return nowMin >= openMin && nowMin < closeMin;
  } else {
    // cruza meia-noite (ex: 18:00 -> 02:00)
    return nowMin >= openMin || nowMin < closeMin;
  }
}

function isStoreOpenNow(hours, status) {
  // Se flag manual indicar fechado agora => fechado
  if (status && status.closed_now) {
    return false;
  }
  // Se modo automático (is_manual_mode === false), usamos horários
  if (!status || status.is_manual_mode === false) {
    const now = new Date();
    const dow = now.getDay(); // 0=Dom, ... 6=Sáb
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = (hours || []).find(h => Number(h.day) === dow);
    if (!today || !today.enabled) return false;
    const openMin = parseTimeToMinutes(today.open);
    const closeMin = parseTimeToMinutes(today.close);
    return isWithinWindow(nowMin, openMin, closeMin);
  }
  // Modo manual e não está fechado explicitamente => consideramos aberto
  return true;
}

module.exports = async function checkStoreOpen(req, res, next) {
  try {
    const [status, hours] = await Promise.all([StoreStatus.get(), StoreHours.getAll()]);
    const open = isStoreOpenNow(hours, status);
    if (!open) {
      return res.status(403).json({
        sucesso: false,
        codigo: 'STORE_CLOSED',
        mensagem: status?.reason ? `Estamos fechados: ${status.reason}` : 'No momento estamos fechados e não é possível finalizar a compra.',
        reopenAt: status?.reopen_at || null
      });
    }
    return next();
  } catch (error) {
    // Em caso de falha ao verificar, por segurança bloqueia
    console.error('Falha ao verificar status da loja:', error);
    return res.status(503).json({
      sucesso: false,
      codigo: 'STORE_STATUS_UNAVAILABLE',
      mensagem: 'Não foi possível verificar o status da loja. Tente novamente em instantes.'
    });
  }
};
