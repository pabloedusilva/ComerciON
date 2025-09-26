// Dashboard com métricas e gráficos
const { pool } = require('../../config/database');

// Helpers de data (UTC)
function startOfMonthUTC(date = new Date()) {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
	return d;
}
function startOfPrevMonthUTC(date = new Date()) {
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth();
	const d = new Date(Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1, 0, 0, 0));
	return d;
}
function startOfNextMonthUTC(date = new Date()) {
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth();
	const d = new Date(Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1, 0, 0, 0));
	return d;
}

function formatDateUTC(d) {
	return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
}

function pctChange(current, prev) {
	const c = Number(current) || 0;
	const p = Number(prev) || 0;
	if (p === 0) return c > 0 ? 100 : 0;
	return ((c - p) / p) * 100;
}

async function getMonthStats() {
	const now = new Date();
	const start = startOfMonthUTC(now);
	const end = startOfNextMonthUTC(now);
	const prevStart = startOfPrevMonthUTC(now);
	const prevEnd = start;

	// Receita e pedidos do mês (exclui cancelados)
	const [[curAgg]] = await pool.query(
		`SELECT COALESCE(SUM(total),0) as receita, COUNT(*) as pedidos
		 FROM pedido
		 WHERE created_at >= ? AND created_at < ? AND status <> 'cancelado'`,
		[formatDateUTC(start), formatDateUTC(end)]
	);

	const [[prevAgg]] = await pool.query(
		`SELECT COALESCE(SUM(total),0) as receita, COUNT(*) as pedidos
		 FROM pedido
		 WHERE created_at >= ? AND created_at < ? AND status <> 'cancelado'`,
		[formatDateUTC(prevStart), formatDateUTC(prevEnd)]
	);

	// Novos clientes do mês
	const [[curClients]] = await pool.query(
		`SELECT COUNT(*) as novos FROM usuarios WHERE data_cadastro >= ? AND data_cadastro < ?`,
		[formatDateUTC(start), formatDateUTC(end)]
	);
	const [[prevClients]] = await pool.query(
		`SELECT COUNT(*) as novos FROM usuarios WHERE data_cadastro >= ? AND data_cadastro < ?`,
		[formatDateUTC(prevStart), formatDateUTC(prevEnd)]
	);

		// Produtos ativos (conforme model Product: status = 'active')
		const [[prodAtivos]] = await pool.query(
			`SELECT COUNT(*) as ativos FROM products WHERE status = 'active'`
		);

	return {
		receita_mes: Number(curAgg.receita || 0),
		pedidos_mes: Number(curAgg.pedidos || 0),
		novos_clientes_mes: Number(curClients.novos || 0),
		produtos_ativos: Number(prodAtivos.ativos || 0),
		tendencia: {
			receita: pctChange(curAgg.receita, prevAgg.receita),
			pedidos: pctChange(curAgg.pedidos, prevAgg.pedidos),
			clientes: pctChange(curClients.novos, prevClients.novos),
			produtos: 0
		}
	};
}

async function getRecentOrders(limit = 5) {
	const [rows] = await pool.query(
		`SELECT p.id, p.status, p.total, p.created_at, u.nome as cliente
		 FROM pedido p JOIN usuarios u ON u.id = p.user_id
		 ORDER BY p.created_at DESC
		 LIMIT ?`,
		[Number(limit) || 5]
	);
	return rows.map(r => ({
		id: r.id,
		status: String(r.status || 'pendente'),
		total: Number(r.total || 0),
		data: r.created_at,
		cliente: r.cliente
	}));
}

async function getPopularProducts(days = 30, limit = 3) {
	const since = new Date();
	since.setUTCDate(since.getUTCDate() - (Number(days) || 30));
	const [rows] = await pool.query(
		`SELECT pr.id, pr.name, COALESCE(SUM(i.quantity),0) as vendas,
						COALESCE(SUM(i.quantity * i.unit_price),0) as receita
		 FROM pedido_itens i
		 JOIN products pr ON pr.id = i.product_id
		 JOIN pedido p ON p.id = i.order_id
		 WHERE p.created_at >= ? AND p.status <> 'cancelado'
		 GROUP BY pr.id, pr.name
		 ORDER BY vendas DESC, receita DESC
		 LIMIT ?`,
		[formatDateUTC(since), Number(limit) || 3]
	);
	return rows.map(r => ({ id: r.id, name: r.name, vendas: Number(r.vendas||0), receita: Number(r.receita||0) }));
}

async function getSalesSeries(days = 7) {
	const d = Number(days) || 7;
	// Gera janelas diárias retroativas
	const labels = [];
	const data = [];
	for (let i = d - 1; i >= 0; i--) {
		const day = new Date();
		day.setUTCHours(0,0,0,0);
		day.setUTCDate(day.getUTCDate() - i);
		const next = new Date(day);
		next.setUTCDate(day.getUTCDate() + 1);

		const [[row]] = await pool.query(
			`SELECT COALESCE(SUM(total),0) as receita
			 FROM pedido
			 WHERE created_at >= ? AND created_at < ? AND status <> 'cancelado'`,
			[formatDateUTC(day), formatDateUTC(next)]
		);
		labels.push(day.toISOString().slice(0,10));
		data.push(Number(row.receita || 0));
	}
	return { labels, data };
}

module.exports = {
	// GET /api/admin/dashboard
	async summary(req, res) {
		try {
			const [stats, recent, popular, series] = await Promise.all([
				getMonthStats(),
				getRecentOrders(5),
				getPopularProducts(30, 3),
				getSalesSeries(7)
			]);
			return res.json({ sucesso: true, data: {
				stats,
				recentOrders: recent,
				popularProducts: popular,
				series: { vendas_7d: series }
			}});
		} catch (e) {
			console.error('Erro dashboard summary:', e);
			return res.status(500).json({ sucesso: false, mensagem: 'Erro ao calcular dashboard' });
		}
	}
};