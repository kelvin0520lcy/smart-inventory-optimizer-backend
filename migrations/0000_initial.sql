-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  plan TEXT DEFAULT 'free'
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  price REAL NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  reorder_point INTEGER DEFAULT 5,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  platforms TEXT NOT NULL DEFAULT '[]',
  platform_ids TEXT NOT NULL DEFAULT '[]',
  user_id INTEGER REFERENCES users(id)
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  sale_date TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  platform TEXT,
  revenue REAL
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_info TEXT,
  performance INTEGER DEFAULT 0,
  lead_time INTEGER DEFAULT 7,
  user_id INTEGER REFERENCES users(id)
);

-- Create product_suppliers table
CREATE TABLE IF NOT EXISTS product_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  price REAL,
  min_order_quantity INTEGER DEFAULT 1
);

-- Create forecasts table
CREATE TABLE IF NOT EXISTS forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id),
  forecast_date TEXT NOT NULL,
  forecast_quantity INTEGER NOT NULL,
  confidence REAL DEFAULT 0.9,
  user_id INTEGER REFERENCES users(id)
);

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  platform TEXT NOT NULL,
  is_connected INTEGER DEFAULT 0,
  api_key TEXT,
  api_secret TEXT,
  store_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,
  last_synced TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_product_id ON forecasts(product_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_user_id ON forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);

-- Insert demo user
INSERT INTO users (username, password, full_name, email, plan)
VALUES ('demo', 'demo123', 'Demo User', 'demo@example.com', 'free'); 