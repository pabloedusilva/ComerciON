// Model StoreHours - Horários de funcionamento
const { pool } = require('../config/database');

const StoreHours = {
  async getAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT day_of_week, enabled, open_time, close_time, created_at, updated_at
        FROM StoreHours 
        ORDER BY day_of_week
      `);
      
      const hours = [];
      
      // Garantir que temos todos os dias da semana (0-6)
      for (let day = 0; day <= 6; day++) {
        const existing = rows.find(row => row.day_of_week === day);
        if (existing) {
          hours.push({
            day: existing.day_of_week,
            enabled: Boolean(existing.enabled),
            open: existing.open_time.substring(0, 5), // "HH:MM"
            close: existing.close_time.substring(0, 5), // "HH:MM"
            created_at: existing.created_at,
            updated_at: existing.updated_at
          });
        } else {
          // Criar horário padrão para dias faltantes
          hours.push({
            day: day,
            enabled: true,
            open: '18:00',
            close: '23:00'
          });
        }
      }
      
      return hours;
    } catch (error) {
      console.error('Erro ao buscar horários da loja:', error);
      throw error;
    }
  },

  async update(hoursArray) {
    try {
      if (!Array.isArray(hoursArray) || hoursArray.length !== 7) {
        throw new Error('Deve fornecer array com 7 horários (um para cada dia da semana)');
      }

      // Usar transação para garantir consistência
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        for (let i = 0; i < hoursArray.length; i++) {
          const hour = hoursArray[i];
          const dayOfWeek = i; // 0 = Domingo, 1 = Segunda, etc.
          
          await connection.execute(`
            INSERT INTO StoreHours (day_of_week, enabled, open_time, close_time) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              enabled = VALUES(enabled), 
              open_time = VALUES(open_time), 
              close_time = VALUES(close_time),
              updated_at = NOW()
          `, [
            dayOfWeek,
            Boolean(hour.enabled),
            `${hour.open}:00`, // Converter "HH:MM" para "HH:MM:SS"
            `${hour.close}:00`  // Converter "HH:MM" para "HH:MM:SS"
          ]);
        }

        await connection.commit();
        connection.release();
        
        return this.getAll();
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error('Erro ao atualizar horários da loja:', error);
      throw error;
    }
  },

  async reset() {
    try {
      const defaultHours = [
        { enabled: true, open: '18:00', close: '23:00' }, // Domingo
        { enabled: true, open: '18:00', close: '23:00' }, // Segunda
        { enabled: true, open: '18:00', close: '23:00' }, // Terça
        { enabled: true, open: '18:00', close: '23:00' }, // Quarta
        { enabled: true, open: '18:00', close: '23:00' }, // Quinta
        { enabled: true, open: '18:00', close: '23:00' }, // Sexta
        { enabled: true, open: '18:00', close: '23:00' }  // Sábado
      ];
      
      return this.update(defaultHours);
    } catch (error) {
      console.error('Erro ao resetar horários da loja:', error);
      throw error;
    }
  }
};

module.exports = StoreHours;