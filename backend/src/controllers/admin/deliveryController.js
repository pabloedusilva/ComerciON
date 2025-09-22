// Gestão de entregas e áreas (Admin)
const DeliveryArea = require('../../models/DeliveryArea');

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

module.exports = {
	listAreas,
	upsertArea,
	deleteArea,
	getZeroStats
};