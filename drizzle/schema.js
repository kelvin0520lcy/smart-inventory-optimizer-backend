import { pgTable, serial, text, timestamp, integer, jsonb, uuid, numeric } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  role: text('role').default('user'),
  plan: text('plan').default('free'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  preferences: jsonb('preferences').default({}),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  sku: text('sku'),
  description: text('description'),
  category: text('category'),
  price: numeric('price'),
  cost: numeric('cost'),
  minStockLevel: integer('min_stock_level').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  stockQuantity: integer('stock_quantity').default(0),
  lowStockThreshold: integer('low_stock_threshold'),
  reorderPoint: integer('reorder_point').default(10),
  brand: text('brand'),
  shopifyProductId: text('shopify_product_id'),
  shopifyVariantId: text('shopify_variant_id'),
  platforms: text('platforms').array(),
  platformIds: text('platform_ids').array(),
});

export const aiAnalyses = pgTable('ai_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  priceAnalysis: jsonb('price_analysis'),
  stockAnalysis: jsonb('stock_analysis'),
  forecastAnalysis: jsonb('forecast_analysis'),
  timestamp: timestamp('timestamp').defaultNow(),
}); 