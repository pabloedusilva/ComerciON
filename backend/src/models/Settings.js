// Model Settings - Informações da pizzaria e preferências
const { pool } = require('../config/database');

const DEFAULTS = {
  id: 1,
  name: 'Pizzaria',
  phone: '(11) 99999-9999',
  email: 'contato@pizzaria.com',
  address: 'São Paulo, SP',
  notification_sound: '/assets/sounds/notificações1.mp3',
  notification_enabled: 1,
};

const Settings = {
  async get() {
    const [rows] = await pool.execute('SELECT * FROM `Settings` WHERE id = 1');
    if (!rows[0]) return { ...DEFAULTS };
    const r = rows[0];
    return {
      id: 1,
      name: r.name || DEFAULTS.name,
      phone: r.phone || DEFAULTS.phone,
      email: r.email || DEFAULTS.email,
      address: r.address || DEFAULTS.address,
      notification_sound: r.notification_sound || DEFAULTS.notification_sound,
      notification_enabled: Number(r.notification_enabled ?? 1),
      updated_at: r.updated_at,
      created_at: r.created_at,
    };
  },

  async update(partial) {
    const current = await this.get();
    const next = { ...current, ...partial };
    await pool.execute(
      `REPLACE INTO \`Settings\` 
        (id, name, phone, email, address, notification_sound, notification_enabled)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [
        next.name || null,
        next.phone || null,
        next.email || null,
        next.address || null,
        next.notification_sound || null,
        Number(next.notification_enabled ? 1 : 0),
      ]
    );
    return this.get();
  },
};

module.exports = Settings;
