const { pool } = require('../../config/database');

function formatDateUTC(d) {
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
}

function startOfDayUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0,0,0,0);
  return d;
}

function startOfMonthUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
}

function addDaysUTC(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Início do dia local (00:00) convertido para UTC, com base em um offset de minutos
function startOfLocalDayUTC(now, tzOffsetMinutes) {
  const offsetMs = (Number(tzOffsetMinutes) || 0) * 60000;
  const shifted = new Date(now.getTime() + offsetMs);
  const localDayStartMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0,0,0);
  return new Date(localDayStartMs - offsetMs);
}

async function getSalesSeries(period, baseNow, overrideTzOffsetMin) {
  const { tzOffsetMinutes = -180 } = require('../../config/environment');
  const tzMin = (overrideTzOffsetMin !== undefined && overrideTzOffsetMin !== null) ? Number(overrideTzOffsetMin) : Number(tzOffsetMinutes) || 0;
  const now = baseNow instanceof Date && !isNaN(baseNow) ? baseNow : new Date();
  const offsetMs = tzMin * 60000;
  if (period === 7 || period === '7') {
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
      // Shift to local time, take start of day, then shift back
  const shifted = new Date(now.getTime() + offsetMs);
      const localDayStartMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0,0,0);
      const day = new Date(localDayStartMs - offsetMs - i * 24 * 60 * 60 * 1000);
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const [[row]] = await pool.query(
        `SELECT COALESCE(SUM(total),0) as receita
         FROM pedido
         WHERE created_at >= ? AND created_at < ? AND status <> 'cancelado'`,
        [formatDateUTC(day), formatDateUTC(next)]
      );
      labels.push(day.toISOString().slice(5,10).split('-').reverse().join('/'));
      data.push(Number(row?.receita || 0));
    }
    return { labels, data };
  }
  if (period === 30 || period === '30') {
    const labels = [];
    const data = [];
    for (let i = 29; i >= 0; i--) {
  const shifted = new Date(now.getTime() + offsetMs);
      const localDayStartMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0,0,0);
      const day = new Date(localDayStartMs - offsetMs - i * 24 * 60 * 60 * 1000);
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const [[row]] = await pool.query(
        `SELECT COALESCE(SUM(total),0) as receita
         FROM pedido
         WHERE created_at >= ? AND created_at < ? AND status <> 'cancelado'`,
        [formatDateUTC(day), formatDateUTC(next)]
      );
      labels.push(day.toISOString().slice(5,10).split('-').reverse().join('/'));
      data.push(Number(row?.receita || 0));
    }
    return { labels, data };
  }
  if (period === 90 || period === '90') {
    // 12 semanas (aprox. 3 meses)
    const labels = [];
    const data = [];
    // Encontrar início da semana atual baseado no horário local (offset)
    const shifted = new Date(now.getTime() + offsetMs);
    const localToday = startOfDayUTC(shifted);
    const dayOfWeek = localToday.getUTCDay(); // 0 = Dom, queremos segunda como início
    const startOfThisWeekLocal = addDaysUTC(localToday, -(dayOfWeek === 0 ? 6 : (dayOfWeek - 1)));
    for (let w = 11; w >= 0; w--) {
      // Converter início local para UTC real removendo o offset
      const startLocal = addDaysUTC(startOfThisWeekLocal, -7*w);
      const start = new Date(startLocal.getTime() - offsetMs);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const [[row]] = await pool.query(
        `SELECT COALESCE(SUM(total),0) as receita
         FROM pedido
         WHERE created_at >= ? AND created_at < ? AND status <> 'cancelado'`,
        [formatDateUTC(start), formatDateUTC(end)]
      );
      labels.push(`Sem ${12 - w}`);
      data.push(Number(row?.receita || 0));
    }
    return { labels, data };
  }
  // 365 -> 12 meses
  const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labels = [];
  const data = [];
  const cur = new Date();
  cur.setUTCDate(1); cur.setUTCHours(0,0,0,0);
  for (let m = 11; m >= 0; m--) {
    const ref = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth()-m, 1, 0,0,0));
    const start = startOfMonthUTC(ref);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth()+1, 1, 0,0,0));
    const [[row]] = await pool.query(
      `SELECT COALESCE(SUM(total),0) as receita
       FROM pedido
       WHERE created_at >= ? AND created_at < ? AND status <> 'cancelado'`,
      [formatDateUTC(start), formatDateUTC(end)]
    );
    labels.push(monthNames[start.getUTCMonth()]);
    data.push(Number(row?.receita || 0));
  }
  return { labels, data };
}

async function getProductShares(period, baseNow, overrideTzOffsetMin) {
  // Determinar intervalo baseado no horário local (API)
  const { tzOffsetMinutes = -180 } = require('../../config/environment');
  const tzMin = (overrideTzOffsetMin !== undefined && overrideTzOffsetMin !== null) ? Number(overrideTzOffsetMin) : Number(tzOffsetMinutes) || 0;
  const now = baseNow instanceof Date && !isNaN(baseNow) ? baseNow : new Date();
  const startOfToday = startOfLocalDayUTC(now, tzMin);
  let start;
  if (period === 7 || period === '7') start = addDaysUTC(startOfToday, -6);
  else if (period === 30 || period === '30') start = addDaysUTC(startOfToday, -29);
  else if (period === 90 || period === '90') start = addDaysUTC(startOfToday, -89);
  else start = addDaysUTC(startOfToday, -364);
  const end = addDaysUTC(startOfToday, 1);

  const [rows] = await pool.query(
    `SELECT pr.name, COALESCE(SUM(i.quantity),0) as vendas,
            COALESCE(SUM(i.quantity * i.unit_price),0) as receita
     FROM pedido_itens i
     JOIN pedido p ON p.id = i.order_id
     JOIN products pr ON pr.id = i.product_id
     WHERE p.created_at >= ? AND p.status <> 'cancelado'
     GROUP BY pr.name
     ORDER BY vendas DESC, receita DESC
     LIMIT 6`,
    [formatDateUTC(start)]
  );
  const total = rows.reduce((acc, r) => acc + Number(r.vendas||0), 0) || 1;
  const top = rows.slice(0, 4);
  const labels = top.map(r => r.name);
  const percentages = top.map(r => Math.round((Number(r.vendas||0) / total) * 100));
  const counts = top.map(r => Number(r.vendas||0));
  const revenue = top.map(r => Number(r.receita||0));
  return { labels, percentages, counts, revenue };
}

async function getPeakHours(period, baseNow, overrideTzOffsetMin) {
  // Define start similar to product shares, mas com horário local
  const { tzOffsetMinutes = -180 } = require('../../config/environment');
  const tzMin = (overrideTzOffsetMin !== undefined && overrideTzOffsetMin !== null) ? Number(overrideTzOffsetMin) : Number(tzOffsetMinutes) || 0;
  const now = baseNow instanceof Date && !isNaN(baseNow) ? baseNow : new Date();
  const startOfToday = startOfLocalDayUTC(now, tzMin);
  let start;
  if (period === 7 || period === '7') start = addDaysUTC(startOfToday, -6);
  else if (period === 30 || period === '30') start = addDaysUTC(startOfToday, -29);
  else if (period === 90 || period === '90') start = addDaysUTC(startOfToday, -89);
  else start = addDaysUTC(startOfToday, -364);
  const [rows] = await pool.query(
    `SELECT HOUR(created_at) as h, COUNT(*) as pedidos
     FROM pedido
     WHERE created_at >= ? AND status <> 'cancelado'
     GROUP BY HOUR(created_at)
     ORDER BY h ASC`,
    [formatDateUTC(start)]
  );
  const map = new Map(rows.map(r => [Number(r.h), Number(r.pedidos||0)]));
  const hours = [18,19,20,21,22,23];
  const labels = hours.map(h => `${h}h`);
  const data = hours.map(h => map.get(h) || 0);
  return { labels, data };
}

async function getMetrics(period, baseNow, overrideTzOffsetMin) {
  try {
    // Período base (usar horário local baseado na API)
    const { tzOffsetMinutes = -180 } = require('../../config/environment');
    const tzMin = (overrideTzOffsetMin !== undefined && overrideTzOffsetMin !== null) ? Number(overrideTzOffsetMin) : Number(tzOffsetMinutes) || 0;
    const now = baseNow instanceof Date && !isNaN(baseNow) ? baseNow : new Date();
    const startOfToday = startOfLocalDayUTC(now, tzMin);
    let start;
    if (period === '7') start = addDaysUTC(startOfToday, -6);
    else if (period === '30') start = addDaysUTC(startOfToday, -29);
    else if (period === '90') start = addDaysUTC(startOfToday, -89);
    else start = addDaysUTC(startOfToday, -364);
    const end = addDaysUTC(startOfToday, 1);

    // Ticket médio = receita / pedidos (exclui cancelados)
    const [[agg]] = await pool.query(
      `SELECT COALESCE(SUM(total),0) as receita, SUM(CASE WHEN status <> 'cancelado' THEN 1 ELSE 0 END) as pedidos,
              SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) as cancelados,
              COUNT(*) as total
       FROM pedido
       WHERE created_at >= ? AND created_at < ?`,
      [formatDateUTC(start), formatDateUTC(end)]
    );
    const receita = Number(agg?.receita || 0);
    const pedidos = Number(agg?.pedidos || 0);
    const totalPedidos = Number(agg?.total || 0);
    const cancelados = Number(agg?.cancelados || 0);

    const ticketMedio = pedidos > 0 ? receita / pedidos : 0;
    const taxaCancelamento = totalPedidos > 0 ? (cancelados / totalPedidos) * 100 : 0;

    // Avaliação média (se tabela reviews existir)
    let avaliacaoMedia = 0;
    try {
      const [[rev]] = await pool.query(
        `SELECT COALESCE(AVG(rating),0) as media FROM reviews WHERE created_at >= ? AND created_at < ?`,
        [formatDateUTC(start), formatDateUTC(end)]
      );
      avaliacaoMedia = Number(rev?.media || 0);
    } catch (_) { /* tabela pode não existir ainda */ }

    // Tempo médio de entrega: depende de campos (ex.: delivered_at)
    let tempoMedioEntregaMin = 0;
    try {
      const [[t]] = await pool.query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, delivered_at)) as minutos
         FROM pedido
         WHERE delivered_at IS NOT NULL AND status = 'entregue' AND created_at >= ? AND created_at < ?`,
        [formatDateUTC(start), formatDateUTC(end)]
      );
      tempoMedioEntregaMin = Math.max(0, Math.round(Number(t?.minutos || 0)));
    } catch (_) { /* campo pode não existir */ }

    return {
      ticket_medio: ticketMedio,
      taxa_cancelamento: taxaCancelamento,
      avaliacao_media: avaliacaoMedia,
      tempo_medio_entrega_min: tempoMedioEntregaMin
    };
  } catch (e) {
    return { ticket_medio: 0, taxa_cancelamento: 0, avaliacao_media: 0, tempo_medio_entrega_min: 0 };
  }
}

module.exports = {
  async summary(req, res) {
    try {
      const p = String(req.query.period || '7');
      const allowed = new Set(['7','30','90','365']);
      const period = allowed.has(p) ? p : '7';
      // Permitir que o cliente forneça o 'agora' e o offset (minutos) vindos da API de tempo
      const nowParam = req.query.now;
      const tzParam = req.query.tzOffsetMinutes;
      const baseNow = nowParam ? new Date(nowParam) : new Date();
      const overrideTzOffsetMin = (tzParam !== undefined && tzParam !== null) ? Number(tzParam) : undefined;
      const [sales, products, peakHours, metrics] = await Promise.all([
        getSalesSeries(period, baseNow, overrideTzOffsetMin),
        getProductShares(period, baseNow, overrideTzOffsetMin),
        getPeakHours(period, baseNow, overrideTzOffsetMin),
        getMetrics(period, baseNow, overrideTzOffsetMin)
      ]);
      return res.json({ sucesso: true, data: { sales, products, peakHours, metrics } });
    } catch (e) {
      console.error('Erro em reports summary:', e);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar relatórios' });
    }
  }
};
// Relatórios e análises