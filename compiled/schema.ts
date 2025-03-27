import { pgTable, text, serial, integer, boolean, date, numeric, timestamp, real } from "drizzle-orm/pg-core.js";
import { createInsertSchema } from "drizzle-zod.js";
import { z } from "zod.js";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  plan: text("plan").default("free"),
  createdAt: timestamp("created_at").defaultNow()
});

// Product model
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  category: text("category"),
  description: text("description").notNull(),
  price: text("price").notNull(),
  stockQuantity: integer("stock_quantity").notNull(),
  lowStockThreshold: integer("low_stock_threshold"),
  reorderPoint: integer("reorder_point").notNull(),
  brand: text("brand"),
  shopifyProductId: text("shopify_product_id"),
  shopifyVariantId: text("shopify_variant_id"),
  platforms: text("platforms").array(),
  platformIds: text("platform_ids").array(),
  createdAt: timestamp("created_at").defaultNow()
});

// Sales model
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  quantity: integer("quantity").notNull(),
  saleDate: timestamp("sale_date").notNull(),
  revenue: text("revenue"),
  platform: text("platform"),
  externalOrderId: text("external_order_id"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});

// Suppliers model
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  contactInfo: text("contact_info"),
  performance: integer("performance"),
  leadTime: integer("lead_time"),
  createdAt: timestamp("created_at").defaultNow()
});

// Product-Supplier relationship
export const productSuppliers = pgTable("product_suppliers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  price: text("price"),
  minOrderQuantity: integer("min_order_quantity").default(1),
  createdAt: timestamp("created_at").defaultNow()
});

// Forecasts model
export const forecasts = pgTable("forecasts", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  forecastDate: timestamp("forecast_date").notNull(),
  forecastQuantity: integer("forecast_quantity").notNull(),
  confidence: text("confidence"),
  createdAt: timestamp("created_at").defaultNow()
});

// Platform integrations model
export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  platform: text("platform").notNull(),
  isConnected: boolean("is_connected").default(false),
  storeUrl: text("store_url"),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  lastSynced: timestamp("last_synced"),
  settings: text("settings"),
  createdAt: timestamp("created_at").defaultNow()
});

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  plan: z.string().nullable(),
  createdAt: z.date().nullable()
});

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  sku: z.string(),
  price: z.string(),
  stockQuantity: z.number(),
  reorderPoint: z.number(),
  lowStockThreshold: z.number().nullable(),
  userId: z.number(),
  createdAt: z.date().nullable(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  shopifyProductId: z.string().nullable(),
  shopifyVariantId: z.string().nullable(),
  platforms: z.array(z.string()).nullable(),
  platformIds: z.array(z.string()).nullable()
});

export const insertProductSchema = productSchema.omit({ id: true, createdAt: true });

export type Product = z.infer<typeof productSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Sale schema
export const saleSchema = z.object({
  id: z.number(),
  userId: z.number(),
  productId: z.number(),
  quantity: z.number(),
  saleDate: z.date(),
  revenue: z.string().nullable(),
  platform: z.string().nullable(),
  externalOrderId: z.string().nullable(),
  customerEmail: z.string().nullable(),
  customerName: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date().nullable()
});

export const insertSaleSchema = saleSchema.omit({ id: true, createdAt: true });

export type Sale = z.infer<typeof saleSchema>;
export type InsertSale = z.infer<typeof insertSaleSchema>;

// Supplier schema
export const supplierSchema = z.object({
  id: z.number(),
  name: z.string(),
  userId: z.number(),
  contactInfo: z.string().nullable(),
  performance: z.number().nullable(),
  leadTime: z.number().nullable(),
  createdAt: z.date().nullable()
});

export const insertSupplierSchema = supplierSchema.omit({ id: true, createdAt: true });

export type Supplier = z.infer<typeof supplierSchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

// ProductSupplier schema
export const productSupplierSchema = z.object({
  id: z.number(),
  productId: z.number(),
  supplierId: z.number(),
  price: z.string().nullable(),
  minOrderQuantity: z.number().nullable(),
  createdAt: z.date().nullable()
});

export const insertProductSupplierSchema = productSupplierSchema.omit({ id: true, createdAt: true });

export type ProductSupplier = z.infer<typeof productSupplierSchema>;
export type InsertProductSupplier = z.infer<typeof insertProductSupplierSchema>;

// Forecast schema
export const forecastSchema = z.object({
  id: z.number(),
  productId: z.number(),
  userId: z.number(),
  forecastDate: z.date(),
  forecastQuantity: z.number(),
  confidence: z.string(),
  createdAt: z.date().nullable()
});

export const insertForecastSchema = forecastSchema.omit({ id: true, createdAt: true });

export type Forecast = z.infer<typeof forecastSchema>;
export type InsertForecast = z.infer<typeof insertForecastSchema>;

// Integration schema
export const integrationSchema = z.object({
  id: z.number(),
  userId: z.number(),
  platform: z.string(),
  isConnected: z.boolean().default(false),
  storeUrl: z.string().nullable(),
  apiKey: z.string().nullable(),
  apiSecret: z.string().nullable(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  expiresAt: z.date().nullable(),
  lastSynced: z.date().nullable(),
  settings: z.record(z.unknown()).nullable(),
  createdAt: z.date().nullable()
});

export const insertIntegrationSchema = integrationSchema.omit({ id: true, createdAt: true });

export type Integration = z.infer<typeof integrationSchema>;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
