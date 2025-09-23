// Gestão de entregas e áreas (Admin)
const DeliveryArea = require('../../models/DeliveryArea');
const { pool } = require('../../config/database');

// Lista todas as áreas (ativas ou não) para administração
async function listAreas(req, res) {
	try {
		const areas = await DeliveryArea.getAll();
		res.json({ sucesso: true, areas });
	} catch (err) {
		console.error('Erro ao listar áreas de entrega:', err);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar áreas de entrega' });
	}
}

// Cria/atualiza área por combinação de UF+cidade ou por id
async function upsertArea(req, res) {
	try {
		const { id, stateId, stateName, stateUf, cityId, cityName, fee, active } = req.body || {};

		if (!stateName || !stateUf || !cityName || fee === undefined) {
			return res.status(400).json({ sucesso: false, mensagem: 'Campos obrigatórios: stateName, stateUf, cityName, fee' });
		}

		const area = await DeliveryArea.createOrUpdate({ id, stateId, stateName, stateUf, cityId, cityName, fee, active });
		res.json({ sucesso: true, area });
	} catch (err) {
		console.error('Erro ao salvar área de entrega:', err);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar área de entrega' });
	}
}

// Remove área por id
async function deleteArea(req, res) {
	try {
		const { id } = req.params;
		if (!id) return res.status(400).json({ sucesso: false, mensagem: 'ID é obrigatório' });
		await DeliveryArea.remove(id);
		res.json({ sucesso: true });
	} catch (err) {
		console.error('Erro ao remover área de entrega:', err);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover área de entrega' });
	}
}

// Estatísticas de entregas: retornar sempre zerado, mas vinculado ao BD (quantidade de cidades configuradas)
async function getZeroStats(req, res) {
	try {
		const areas = await DeliveryArea.getAll();
		res.json({
			sucesso: true,
			stats: {
				totalDeliveries: 0,
				avgTicket: 0,
				citiesCount: areas.length,
				topCities: areas.map(a => ({
					cityName: a.cityName,
					stateName: a.stateName,
					stateUf: a.stateUf,
					deliveries: 0,
					revenue: 0
				}))
			}
		});
	} catch (err) {
		console.error('Erro ao carregar estatísticas de entrega:', err);
		res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar estatísticas' });
	}
}

// Estatísticas reais de entregas por cidade/UF baseadas nos pedidos
// - Detecta dinamicamente o schema: tabela orders/pedidos, coluna de FK para usuário e coluna de receita
// - Junta com tabela de usuários (usuarios) para obter cidade/estado
// - Retorna somente cidades com entregas > 0
async function getStats(req, res) {
	try {
		const meta = await detectOrderSchema();
		if (!meta) {
			return res.json({
				sucesso: true,
				stats: { totalDeliveries: 0, avgTicket: 0, citiesCount: 0, topCities: [] }
			});
		}

		const { ordersTable, userFkCol, revenueCol, statusCol, deliveredValues, userTable, cityCol, stateCol } = meta;

		// Monta filtro de status entregue, se aplicável
		let whereDelivered = '';
		let params = [];
		if (statusCol && deliveredValues?.length) {
			whereDelivered = `WHERE LOWER(o\`.${statusCol}\`) IN (${deliveredValues.map(() => '?').join(',')})`;
			params.push(...deliveredValues.map(v => v.toLowerCase()));
		}

		// Fallback: se usuarios não tiver cidade/estado, tentar colunas no próprio pedido
		const joinClause = userTable ? `JOIN \`${userTable}\` u ON u.\`id\` = o.\`${userFkCol}\`` : '';
		const cityExpr = userTable ? `u.\`${cityCol}\`` : `o.\`${cityCol}\``;
		const stateExpr = userTable ? `u.\`${stateCol}\`` : `o.\`${stateCol}\``;

		// Consulta agrupada por cidade/UF
		const sql = `
			SELECT ${cityExpr} AS city_name, ${stateExpr} AS state_uf,
				   COUNT(*) AS deliveries,
				   SUM(COALESCE(o.\`${revenueCol}\`, 0)) AS revenue
			FROM \`${ordersTable}\` o
			${joinClause}
			${whereDelivered}
			GROUP BY ${cityExpr}, ${stateExpr}
			HAVING COUNT(*) > 0 AND ${cityExpr} IS NOT NULL AND ${stateExpr} IS NOT NULL
			ORDER BY deliveries DESC, revenue DESC
			LIMIT 20
		`;

		const [rows] = await pool.execute(sql, params);

		const topCities = rows.map(r => ({
			cityName: r.city_name,
			stateName: r.state_uf, // se desejar nome do estado completo, precisaria de outra fonte; usamos UF aqui
			stateUf: r.state_uf,
			deliveries: Number(r.deliveries) || 0,
			revenue: Number(r.revenue) || 0
		}));

		const totalDeliveries = topCities.reduce((acc, c) => acc + (c.deliveries || 0), 0);
		const totalRevenue = topCities.reduce((acc, c) => acc + (c.revenue || 0), 0);
		const avgTicket = totalDeliveries > 0 ? totalRevenue / totalDeliveries : 0;

		return res.json({
			sucesso: true,
			stats: {
				totalDeliveries,
				avgTicket,
				citiesCount: topCities.length,
				topCities
			}
		});
	} catch (err) {
		console.error('Erro ao calcular estatísticas de entrega:', err);
		// Em caso de erro, não quebrar o dashboard
		return res.json({
			sucesso: true,
			stats: { totalDeliveries: 0, avgTicket: 0, citiesCount: 0, topCities: [] }
		});
	}
}

// Detecta dinamicamente o schema de pedidos e campos relevantes
async function detectOrderSchema() {
	// 1) Descobrir tabela de pedidos: 'orders' ou 'pedidos'
	const [orderTables] = await pool.execute(
		`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('orders','pedidos') LIMIT 1`
	);
	if (!orderTables.length) return null;
	const ordersTable = orderTables[0].TABLE_NAME;

	// 2) Colunas da tabela de pedidos
	const [orderColsRows] = await pool.execute(
		`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
		[ordersTable]
	);
	const orderCols = orderColsRows.map(r => r.COLUMN_NAME);
	const lowerSet = new Set(orderCols.map(c => c.toLowerCase()));

	// 3) Detectar coluna FK usuário
	const userFkCandidates = ['usuario_id','user_id','cliente_id','customer_id','usuario','user','cliente'];
	const userFkCol = userFkCandidates.find(c => lowerSet.has(c));
	if (!userFkCol) return null; // sem como ligar cidade/estado

	// 4) Detectar coluna de receita
	const revenueCandidates = ['total','valor_total','valor','amount','total_amount','preco_total','total_price'];
	const revenueCol = revenueCandidates.find(c => lowerSet.has(c));
	const revenueColSafe = revenueCol || null; // pode não existir; trataremos como 0

	// 5) Detectar status entregue (opcional)
	const statusCandidates = ['status','situacao','estado','order_status','entrega_status'];
	const statusCol = statusCandidates.find(c => lowerSet.has(c));
	const deliveredValues = statusCol ? ['delivered','entregue','concluido','completed','finalizado'] : [];

	// 6) Tabela de usuários e colunas de cidade/estado
	let userTable = null, cityCol = null, stateCol = null;
	const [userTables] = await pool.execute(
		`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('usuarios','users') LIMIT 1`
	);
	if (userTables.length) {
		userTable = userTables[0].TABLE_NAME;
		const [userColsRows] = await pool.execute(
			`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
			[userTable]
		);
		const userCols = userColsRows.map(r => r.COLUMN_NAME.toLowerCase());
		// Preferir português
		cityCol = userCols.includes('cidade') ? 'cidade' : (userCols.includes('city') ? 'city' : null);
		stateCol = userCols.includes('estado') ? 'estado' : (userCols.includes('uf') ? 'uf' : (userCols.includes('state') ? 'state' : null));
	}

	// Fallback: tentar colunas diretamente na tabela de pedidos
	if (!cityCol || !stateCol) {
		const cityCandidates = ['cidade','city'];
		const stateCandidates = ['estado','uf','state'];
		const cityInOrder = cityCandidates.find(c => lowerSet.has(c));
		const stateInOrder = stateCandidates.find(c => lowerSet.has(c));
		if (cityInOrder && stateInOrder) {
			userTable = null; // não haverá join
			cityCol = cityInOrder;
			stateCol = stateInOrder;
		}
	}

	if (!cityCol || !stateCol) return null; // não conseguimos obter cidade/estado

	return {
		ordersTable,
		userFkCol,
		revenueCol: revenueColSafe || '0', // usado em SUM(COALESCE(...,0))
		statusCol,
		deliveredValues,
		userTable,
		cityCol,
		stateCol
	};
}

module.exports = {
	listAreas,
	upsertArea,
	deleteArea,
	getZeroStats,
	getStats
};