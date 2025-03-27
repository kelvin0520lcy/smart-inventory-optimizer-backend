import { eq, and, lte, desc } from 'drizzle-orm';
import { db } from './index';
import {
  users,
  products,
  suppliers,
  productSuppliers,
  sales,
  forecasts,
  integrations,
  type User,
  type Product,
  type Supplier,
  type ProductSupplier,
  type Sale,
  type Forecast,
  type Integration,
  type InsertUser,
  type InsertProduct,
  type InsertSupplier,
  type InsertProductSupplier,
  type InsertSale,
  type InsertForecast,
  type InsertIntegration
} from '@shared/schema';

export class PostgresStorage {
  // User operations
  async createUser(userData: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(userData).returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  // Add missing user methods
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Add getUser alias for getUserById for compatibility
  async getUser(id: number): Promise<User | undefined> {
    return this.getUserById(id);
  }

  // Product operations
  async getProducts(userId: number): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.userId, userId));
  }

  async getProduct(productId: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    return product;
  }

  async getProductById(productId: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    return product;
  }

  async getProductByPlatformId(userId: number, platform: string, platformId: string): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.userId, userId),
          eq(products.platforms, [platform]),
          eq(products.platformIds, [platformId])
        )
      );
    return product;
  }

  private async generateUniqueSku(baseSku: string): Promise<string> {
    let sku = baseSku;
    let counter = 1;
    
    while (true) {
      try {
        const [existing] = await db
          .select()
          .from(products)
          .where(eq(products.sku, sku));
        
        if (!existing) {
          return sku;
        }
        
        // If SKU exists, append counter
        sku = `${baseSku}-${counter}`;
        counter++;
      } catch (error) {
        console.error('Error checking SKU:', error);
        throw error;
      }
    }
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    try {
      const [product] = await db.insert(products).values(productData).returning();
      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId: number, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, productId))
      .returning();
    return updated;
  }

  async deleteProduct(productId: number): Promise<Product | undefined> {
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, productId))
      .returning();
    return deleted;
  }

  async getLowStockProducts(userId: number, threshold?: number): Promise<Product[]> {
    const userProducts = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.userId, userId),
          threshold !== undefined
            ? lte(products.stockQuantity, threshold)
            : lte(products.stockQuantity, products.lowStockThreshold)
        )
      );
    return userProducts;
  }

  // Sales operations
  async getSales(userId: number): Promise<Sale[]> {
    return await db.select().from(sales).where(eq(sales.userId, userId));
  }

  async getSalesByProduct(productId: number): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.productId, productId))
      .orderBy(desc(sales.saleDate));
  }

  async createSale(saleData: InsertSale): Promise<Sale> {
    const [sale] = await db.insert(sales).values(saleData).returning();
    return sale;
  }

  // Supplier operations
  async getSuppliers(userId: number): Promise<Supplier[]> {
    return await db.select().from(suppliers).where(eq(suppliers.userId, userId));
  }

  async getSupplierById(supplierId: number): Promise<Supplier | undefined> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId));
    return supplier;
  }

  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(supplierData).returning();
    return supplier;
  }

  async updateSupplier(supplierId: number, updateData: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db
      .update(suppliers)
      .set(updateData)
      .where(eq(suppliers.id, supplierId))
      .returning();
    return updated;
  }

  async deleteSupplier(supplierId: number): Promise<Supplier | undefined> {
    const [deleted] = await db
      .delete(suppliers)
      .where(eq(suppliers.id, supplierId))
      .returning();
    return deleted;
  }

  // Product-Supplier operations
  async createProductSupplier(data: InsertProductSupplier): Promise<ProductSupplier> {
    const [productSupplier] = await db
      .insert(productSuppliers)
      .values(data)
      .returning();
    return productSupplier;
  }

  async getProductSuppliers(productId: number): Promise<ProductSupplier[]> {
    return await db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.productId, productId));
  }

  async getProductSuppliersBySupplierId(supplierId: number): Promise<ProductSupplier[]> {
    return await db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.supplierId, supplierId));
  }

  async deleteProductSupplier(id: number): Promise<ProductSupplier | undefined> {
    const [deleted] = await db
      .delete(productSuppliers)
      .where(eq(productSuppliers.id, id))
      .returning();
    return deleted;
  }

  // Forecast operations
  async getForecasts(userId: number): Promise<Forecast[]> {
    return await db.select().from(forecasts).where(eq(forecasts.userId, userId));
  }

  async getForecastsByProduct(productId: number): Promise<Forecast[]> {
    return await db
      .select()
      .from(forecasts)
      .where(eq(forecasts.productId, productId))
      .orderBy(desc(forecasts.forecastDate));
  }

  async createForecast(forecastData: InsertForecast): Promise<Forecast> {
    const [forecast] = await db.insert(forecasts).values(forecastData).returning();
    return forecast;
  }

  async deleteForecast(id: number): Promise<boolean> {
    try {
      console.log(`Deleting forecast with ID: ${id}`);
      const result = await db.delete(forecasts)
        .where(eq(forecasts.id, id))
        .returning({ id: forecasts.id });
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting forecast:', error);
      return false;
    }
  }

  // Integration operations
  async getIntegrations(userId: number): Promise<Integration[]> {
    return await db
      .select()
      .from(integrations)
      .where(eq(integrations.userId, userId));
  }

  async getIntegrationByPlatform(userId: number, platform: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, userId),
          eq(integrations.platform, platform)
        )
      );
    return integration;
  }

  async createIntegration(integrationData: InsertIntegration): Promise<Integration> {
    try {
      const [integration] = await db.insert(integrations).values(integrationData).returning();
      return integration;
    } catch (error) {
      console.error('Error creating integration:', error);
      throw error;
    }
  }

  async updateIntegration(integrationId: number, updateData: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const [updated] = await db
      .update(integrations)
      .set(updateData)
      .where(eq(integrations.id, integrationId))
      .returning();
    return updated;
  }

  async getIntegrationByStoreUrl(storeUrl: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.storeUrl, storeUrl));
    return integration;
  }

  async deleteSale(id: number): Promise<boolean> {
    try {
      console.log(`Deleting sale with ID: ${id}`);
      const result = await db.delete(sales)
        .where(eq(sales.id, id))
        .returning({ id: sales.id });
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting sale:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const storage = new PostgresStorage(); 