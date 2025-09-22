// Model DeliveryArea - Áreas de entrega
const { pool } = require('../config/database');

const TABLE = 'delivery_areas';

async function getAll() {
	const [rows] = await pool.query(
		`SELECT id, state_id, state_name, state_uf, city_id, city_name, fee, active,
				created_at, updated_at
		 FROM ${TABLE}
		 ORDER BY state_name ASC, city_name ASC`
	);
	return rows.map(normalizeRow);
}

async function getActive() {
	const [rows] = await pool.query(
		`SELECT id, state_id, state_name, state_uf, city_id, city_name, fee, active,
				created_at, updated_at
		 FROM ${TABLE}
		 WHERE active = 1
		 ORDER BY state_name ASC, city_name ASC`
	);
	return rows.map(normalizeRow);
}

async function findByCityState(cityName, stateUf) {
	const [rows] = await pool.query(
		`SELECT id, state_id, state_name, state_uf, city_id, city_name, fee, active,
				created_at, updated_at
		 FROM ${TABLE}
		 WHERE LOWER(city_name) = LOWER(?) AND UPPER(state_uf) = UPPER(?) AND active = 1
		 LIMIT 1`,
		[cityName, stateUf]
	);
	return rows[0] ? normalizeRow(rows[0]) : null;
}

async function createOrUpdate(area) {
	// Uses unique key on (state_uf, city_name) for idempotent upsert when id not provided
	const now = new Date();
	if (area.id) {
		await pool.query(
			`UPDATE ${TABLE}
			 SET state_id = ?, state_name = ?, state_uf = ?, city_id = ?, city_name = ?, fee = ?, active = ?, updated_at = ?
			 WHERE id = ?`,
			[
				area.stateId || null,
				area.stateName,
				area.stateUf,
				area.cityId || null,
				area.cityName,
				Number(area.fee || 0),
				area.active !== undefined ? (area.active ? 1 : 0) : 1,
				now,
				area.id
			]
		);
		const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [area.id]);
		return rows[0] ? normalizeRow(rows[0]) : null;
	} else {
		const [result] = await pool.query(
			`INSERT INTO ${TABLE}
				(state_id, state_name, state_uf, city_id, city_name, fee, active, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE
				fee = VALUES(fee), active = VALUES(active), updated_at = VALUES(updated_at)`,
			[
				area.stateId || null,
				area.stateName,
				area.stateUf,
				area.cityId || null,
				area.cityName,
				Number(area.fee || 0),
				area.active !== undefined ? (area.active ? 1 : 0) : 1,
				now,
				now
			]
		);
		// If inserted new row, insertId present; otherwise fetch by unique key
		if (result.insertId) {
			const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [result.insertId]);
			return rows[0] ? normalizeRow(rows[0]) : null;
		} else {
			const [rows] = await pool.query(
				`SELECT * FROM ${TABLE} WHERE state_uf = ? AND city_name = ? LIMIT 1`,
				[area.stateUf, area.cityName]
			);
			return rows[0] ? normalizeRow(rows[0]) : null;
		}
	}
}

async function remove(id) {
	await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
	return true;
}

function normalizeRow(row) {
	return {
		id: row.id,
		stateId: row.state_id,
		stateName: row.state_name,
		stateUf: row.state_uf,
		cityId: row.city_id,
		cityName: row.city_name,
		fee: Number(row.fee),
		active: row.active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

module.exports = {
	getAll,
	getActive,
	createOrUpdate,
	remove,
	findByCityState
};