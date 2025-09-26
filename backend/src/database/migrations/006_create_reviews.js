// Migration - Create reviews table
// Estrutura alinhada ao restante do projeto.
// Campos:
//  id INT PK AI
//  user_id -> referencia usuarios.id
//  order_id -> referencia pedido.id
//  product_id (nullable futuramente se quisermos review por item) - neste MVP manteremos NULL sempre
//  rating TINYINT 1..5
//  comment TEXT (limite lógico tratado em controller)
//  verified TINYINT(1) default 0 (pode ser usado depois para moderação manual)
//  created_at / updated_at
//  UNIQUE(user_id, order_id) para garantir 1 avaliação por pedido (independente de itens)

module.exports = async function createReviewsTable(pool) {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS reviews (
			id INT PRIMARY KEY AUTO_INCREMENT,
			user_id INT NOT NULL,
			order_id INT NOT NULL,
			product_id INT NULL,
			rating TINYINT NOT NULL,
			comment TEXT NULL,
			verified TINYINT(1) NOT NULL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
			CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES pedido(id) ON DELETE CASCADE,
			CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
			CONSTRAINT uq_reviews_user_order UNIQUE (user_id, order_id),
			INDEX idx_reviews_order (order_id),
			INDEX idx_reviews_user (user_id),
			INDEX idx_reviews_rating (rating),
			INDEX idx_reviews_created (created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);
};

// Uso (exemplo):
// const { pool } = require('../src/config/database');
// const migrate = require('./src/database/migrations/006_create_reviews');
// migrate(pool).then(()=> console.log('reviews ok')); 