// Delivery public endpoints (read-only)
const DeliveryArea = require('../../models/DeliveryArea');

async function listActiveAreas(req, res) {
    try {
        const areas = await DeliveryArea.getActive();
        res.json({ sucesso: true, areas });
    } catch (err) {
        console.error('Erro ao listar áreas públicas:', err);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar áreas' });
    }
}

async function getFeeByCityState(req, res) {
    try {
        const { city, uf } = req.query;
        if (!city || !uf) return res.status(400).json({ sucesso: false, mensagem: 'Parâmetros city e uf são obrigatórios' });
        const area = await DeliveryArea.findByCityState(city, uf);
        if (!area) return res.json({ sucesso: true, fee: null });
        res.json({ sucesso: true, fee: area.fee, area });
    } catch (err) {
        console.error('Erro ao buscar taxa por cidade/UF:', err);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar taxa' });
    }
}

module.exports = {
    listActiveAreas,
    getFeeByCityState
};
