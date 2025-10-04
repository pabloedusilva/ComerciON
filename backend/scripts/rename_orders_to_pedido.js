/*
  Script: rename_orders_to_pedido.js
  Purpose: Rename legacy tables 'orders' -> 'pedido' and 'order_items' -> 'pedido_itens'
           and normalize status enum/values to the admin UI.
  Usage: node backend/scripts/rename_orders_to_pedido.js
*/

const { pool } = require('../src/config/database');

async function tableExists(name){
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [name]);
  return rows.length > 0;
}

async function renameIfNeeded(oldName, newName){
  const oldExists = await tableExists(oldName);
  const newExists = await tableExists(newName);
  if (oldExists && !newExists) {
    await pool.query(`RENAME TABLE \`${oldName}\` TO \`${newName}\``);
    console.log(`✔ Renomeado ${oldName} -> ${newName}`);
    return true;
  }
  console.log(`• Sem renomear ${oldName} -> ${newName} (oldExists=${oldExists}, newExists=${newExists})`);
  return false;
}

async function ensureStatusEnum(){
  // 1) Tornar status temporariamente VARCHAR para aceitar quaisquer valores existentes
  await pool.query(`
    ALTER TABLE \`pedido\`
      MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pendente'
  `);
  // 2) Normalizar valores para português
  await pool.query("UPDATE \`pedido\` SET status='pendente' WHERE status IN ('paid','pago','pagamento','pending','') OR status IS NULL");
  await pool.query("UPDATE \`pedido\` SET status='cancelado' WHERE status IN ('canceled','cancelled','cancelada','cancelado','cancel')");
  await pool.query("UPDATE \`pedido\` SET status='a_caminho' WHERE status IN ('delivering','delivery','delivery_in_progress','a_caminho','a caminho')");
  await pool.query("UPDATE \`pedido\` SET status='preparando' WHERE status IN ('preparation','preparing','preparando','em_preparo')");
  await pool.query("UPDATE \`pedido\` SET status='entregue' WHERE status IN ('delivered','entregue','finalizado','concluido','done','completed')");
  // 3) Garantir que qualquer valor fora da lista vire 'pendente'
  await pool.query("UPDATE \`pedido\` SET status='pendente' WHERE status NOT IN ('pendente','preparando','a_caminho','entregue','cancelado')");
  // 4) Converter de volta para ENUM final em português
  await pool.query(`
    ALTER TABLE \`pedido\`
      MODIFY COLUMN status ENUM('pendente','preparando','a_caminho','entregue','cancelado') NOT NULL DEFAULT 'pendente'
  `);
  console.log('✔ Status normalizado em pedido (português)');
}

async function ensureFKs(){
  // Depending on MySQL, renaming tables preserves FKs. We just sanity-check columns.
  await pool.query("UPDATE \`pedido\` SET user_id = user_id");
  await pool.query("UPDATE \`pedido_itens\` SET order_id = order_id, product_id = product_id");
}

async function main(){
  try {
    const renamedPedido = await renameIfNeeded('orders','pedido');
    const renamedItens = await renameIfNeeded('order_items','pedido_itens');

    // Garante existência chamando DDL se não existir
    if (!await tableExists('pedido') || !await tableExists('pedido_itens')) {
      console.log('Garantindo tabelas pedido/pedido_itens...');
      const { pool: pool2 } = require('../src/config/database');
      await pool2.query(`
        CREATE TABLE IF NOT EXISTS pedido (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          status ENUM('pendente','preparando','a_caminho','entregue','cancelado') NOT NULL DEFAULT 'pendente',
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
          delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          discount DECIMAL(10,2) NOT NULL DEFAULT 0,
          total DECIMAL(10,2) NOT NULL DEFAULT 0,
          address_json JSON NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_pedido_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await pool2.query(`
        CREATE TABLE IF NOT EXISTS pedido_itens (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT NOT NULL,
          product_id INT NOT NULL,
          category ENUM('pizza','drink') NOT NULL,
          size TINYINT NOT NULL DEFAULT 0,
          quantity INT NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
          name_snapshot VARCHAR(255) NULL,
          removed_ingredients VARCHAR(255) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_pedidoitens_pedido FOREIGN KEY (order_id) REFERENCES pedido(id) ON DELETE CASCADE,
          CONSTRAINT fk_pedidoitens_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    await ensureStatusEnum();
    await ensureFKs();
    console.log('\n✅ Migração concluída');
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha na migração:', err);
    process.exit(1);
  }
}

main();
