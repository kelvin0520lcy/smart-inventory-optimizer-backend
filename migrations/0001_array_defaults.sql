-- Drop existing table
DROP TABLE IF EXISTS products_temp;

-- Create temporary table with new schema
CREATE TABLE products_temp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  price REAL NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  reorder_point INTEGER DEFAULT 5,
  created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
  platforms TEXT DEFAULT '[]',
  platform_ids TEXT DEFAULT '[]',
  user_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Copy data from old table
INSERT INTO products_temp 
SELECT 
  id, 
  name, 
  sku, 
  category, 
  description, 
  price, 
  stock_quantity, 
  low_stock_threshold, 
  reorder_point, 
  created_at, 
  COALESCE(platforms, '[]') as platforms, 
  COALESCE(platform_ids, '[]') as platform_ids, 
  user_id 
FROM products;

-- Drop old table
DROP TABLE products;

-- Rename temporary table
ALTER TABLE products_temp RENAME TO products;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id); 