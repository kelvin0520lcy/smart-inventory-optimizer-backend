import { db } from './index.js';
import { products, users, sales, inventory, inventoryTransactions, integrations, forecasts } from '../../shared/schema.js';
import { eq, and, like, desc, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

/**
 * Get products for a user
 */
export async function getProducts(userId: string) {
  try {
    return await db
      .select()
      .from(products)
      .where(eq(products.userId, userId));
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
}

/**
 * Get a product by ID
 */
export async function getProductById(productId: string) {
  try {
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error getting product by ID:', error);
    return null;
  }
}

/**
 * Get a product by platform ID (e.g., Shopify product ID)
 */
export async function getProductByPlatformId(userId: string, platform: string, platformId: string) {
  try {
    // We'll need to filter in JS since platform IDs are stored in an array
    const allProducts = await getProducts(userId);
    return allProducts.find(p => 
      p.platforms?.includes(platform) && 
      p.platformIds?.includes(platformId)
    ) || null;
  } catch (error) {
    console.error('Error getting product by platform ID:', error);
    return null;
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(userId: string, threshold?: number) {
  try {
    const allProducts = await getProducts(userId);
    return allProducts.filter(p => {
      if (threshold) {
        return p.stockQuantity <= threshold;
      }
      if (p.lowStockThreshold) {
        return p.stockQuantity <= p.lowStockThreshold;
      }
      // Default threshold as 20% of reorder point
      return p.stockQuantity <= (p.reorderPoint * 0.2);
    });
  } catch (error) {
    console.error('Error getting low stock products:', error);
    return [];
  }
}

/**
 * Get sales for a user
 */
export async function getSales(userId: string) {
  try {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.userId, userId));
  } catch (error) {
    console.error('Error getting sales:', error);
    return [];
  }
}

/**
 * Get integrations for a user
 */
export async function getIntegrations(userId: string) {
  try {
    return await db
      .select()
      .from(integrations)
      .where(eq(integrations.userId, userId));
  } catch (error) {
    console.error('Error getting integrations:', error);
    return [];
  }
}

/**
 * Get integration by platform
 */
export async function getIntegrationByPlatform(userId: string, platform: string) {
  try {
    const result = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, userId),
          eq(integrations.platform, platform)
        )
      )
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error getting integration by platform:', error);
    return null;
  }
}

/**
 * Get forecasts for a user
 */
export async function getForecasts(userId: string) {
  try {
    return await db
      .select()
      .from(forecasts)
      .where(eq(forecasts.userId, userId));
  } catch (error) {
    console.error('Error getting forecasts:', error);
    return [];
  }
}

/**
 * Update an integration
 */
export async function updateIntegration(integrationId: string, data: any) {
  try {
    await db
      .update(integrations)
      .set(data)
      .where(eq(integrations.id, integrationId));
    
    const result = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, integrationId))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error('Error updating integration:', error);
    return null;
  }
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string) {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Create a user
 */
export async function createUser(userData: any) {
  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const result = await db.insert(users).values({
      id: uuidv4(),
      username: userData.username,
      password: hashedPassword,
      email: userData.email,
      fullName: userData.fullName,
      plan: userData.plan || 'free',
    }).returning();
    
    return result[0] || null;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

/**
 * Create a supplier
 */
export async function createSupplier(supplierData: any) {
  // Suppliers table not implemented yet
  return { id: uuidv4(), ...supplierData };
}

/**
 * Get product suppliers
 */
export async function getProductSuppliers(productId: string) {
  // Product suppliers table not implemented yet
  return [];
}

/**
 * Create a product supplier relationship
 */
export async function createProductSupplier(productSupplierData: any) {
  // Product suppliers table not implemented yet
  return { id: uuidv4(), ...productSupplierData };
}

/**
 * Get suppliers for a user
 */
export async function getSuppliers(userId: string) {
  // Suppliers table not implemented yet
  return [];
}

/**
 * Get a user by their ID
 */
export async function getUserById(userId: string) {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Update a user's profile
 */
export async function updateUser(userId: string, data: { fullName?: string; email?: string; }) {
  try {
    await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    return await getUserById(userId);
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
}

export { 
  getProducts,
  getProductById,
  getProductByPlatformId,
  getLowStockProducts,
  getSales,
  getIntegrations,
  getIntegrationByPlatform,
  getForecasts,
  updateIntegration,
  getSuppliers,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  updateUser,
  createUser,
  createSupplier,
  getProductSuppliers,
  createProductSupplier
}; 