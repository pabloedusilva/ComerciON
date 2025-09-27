// Model StoreStatus - Status atual da loja
const { pool } = require('../config/database');

const StoreStatus = {
  async get() {
    try {
      const [rows] = await pool.execute('SELECT * FROM StoreStatus WHERE id = 1');
      if (!rows[0]) {
        // Criar registro padrão se não existir
        await pool.execute(`
          INSERT INTO StoreStatus (id, closed_now, reason, reopen_at, notify_whatsapp, notify_email, is_manual_mode) 
          VALUES (1, FALSE, '', NULL, FALSE, FALSE, FALSE)
        `);
        return {
          id: 1,
          closed_now: false,
          reason: '',
          reopen_at: null,
          notify_whatsapp: false,
          notify_email: false,
          is_manual_mode: false
        };
      }
      
      const row = rows[0];
      return {
        id: row.id,
        closed_now: Boolean(row.closed_now),
        reason: row.reason || '',
        reopen_at: row.reopen_at,
        notify_whatsapp: Boolean(row.notify_whatsapp),
        notify_email: Boolean(row.notify_email),
        is_manual_mode: Boolean(row.is_manual_mode),
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error) {
      console.error('Erro ao buscar status da loja:', error);
      throw error;
    }
  },

  async update(data) {
    try {
      const {
        closed_now = false,
        reason = '',
        reopen_at = null,
        notify_whatsapp = false,
        notify_email = false,
        is_manual_mode = false
      } = data;

      await pool.execute(`
        UPDATE StoreStatus 
        SET closed_now = ?, reason = ?, reopen_at = ?, notify_whatsapp = ?, notify_email = ?, is_manual_mode = ?, updated_at = NOW()
        WHERE id = 1
      `, [
        Boolean(closed_now),
        String(reason || ''),
        reopen_at ? new Date(reopen_at) : null,
        Boolean(notify_whatsapp),
        Boolean(notify_email),
        Boolean(is_manual_mode)
      ]);

      return this.get();
    } catch (error) {
      console.error('Erro ao atualizar status da loja:', error);
      throw error;
    }
  }
};

module.exports = StoreStatus;