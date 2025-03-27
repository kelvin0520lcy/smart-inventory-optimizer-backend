-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ai_analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  price_analysis JSONB,
  stock_analysis JSONB,
  forecast_analysis JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_analyses_product_id ON ai_analyses(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_timestamp ON ai_analyses(timestamp); 