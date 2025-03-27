import 'dotenv/config';
import { db } from './db';
import { 
  users, products, sales, suppliers, 
  productSuppliers, forecasts, integrations 
} from '@shared/schema';
import { eq } from 'drizzle-orm';

async function clearTables() {
  console.log('Clearing existing data...');
  await db.delete(forecasts);
  await db.delete(sales);
  await db.delete(productSuppliers);
  await db.delete(products);
  await db.delete(suppliers);
  await db.delete(integrations);
  await db.delete(users);
  console.log('All tables cleared');
}

async function seedData() {
  try {
    // Clear existing data
    await clearTables();
    console.log('Tables cleared successfully');

    // Create demo user
    console.log('Creating demo user...');
    const [user] = await db.insert(users).values({
      username: 'demo',
      password: 'demo123',
      email: 'demo@example.com',
      fullName: 'Demo User',
      plan: 'pro'
    }).returning();
    console.log('Created demo user:', user);

    // Create suppliers
    console.log('Creating suppliers...');
    const suppliersData = [
      {
        name: 'TechSupply Co',
        contactInfo: 'contact@techsupply.co',
        performance: 95,
        leadTime: 5,
        userId: user.id
      },
      {
        name: 'EcoGoods Ltd',
        contactInfo: 'orders@ecogoods.com',
        performance: 88,
        leadTime: 7,
        userId: user.id
      },
      {
        name: 'Premium Distributors',
        contactInfo: 'sales@premiumdist.com',
        performance: 92,
        leadTime: 3,
        userId: user.id
      }
    ];

    const createdSuppliers = await db.insert(suppliers).values(suppliersData).returning();
    console.log('Created suppliers:', createdSuppliers);

    // Create products
    console.log('Creating products...');
    const productsData = [
      {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        sku: 'WH-001',
        price: '129.99',
        stockQuantity: 3,
        lowStockThreshold: 10,
        reorderPoint: 5,
        category: 'Electronics',
        userId: user.id,
        platforms: ['shopify'],
        platformIds: ['123456789']
      },
      {
        name: 'Premium Water Bottle',
        description: 'Insulated stainless steel water bottle',
        sku: 'WB-002',
        price: '24.99',
        stockQuantity: 45,
        lowStockThreshold: 20,
        reorderPoint: 15,
        category: 'Accessories',
        userId: user.id
      },
      {
        name: 'Organic Cotton T-Shirt (M)',
        description: 'Medium-sized organic cotton t-shirt',
        sku: 'TS-003-M',
        price: '29.99',
        stockQuantity: 8,
        lowStockThreshold: 15,
        reorderPoint: 10,
        category: 'Apparel',
        userId: user.id
      },
      {
        name: 'Smart Home Hub',
        description: 'Central hub for smart home automation',
        sku: 'SH-004',
        price: '199.99',
        stockQuantity: 12,
        lowStockThreshold: 8,
        reorderPoint: 5,
        category: 'Electronics',
        userId: user.id
      }
    ];

    const createdProducts = await db.insert(products).values(productsData).returning();
    console.log('Created products:', createdProducts);

    // Create product-supplier relationships
    console.log('Creating product-supplier relationships...');
    const productSuppliersData = [
      {
        productId: createdProducts[0].id,
        supplierId: createdSuppliers[0].id,
        price: '89.99',
        minOrderQuantity: 10
      },
      {
        productId: createdProducts[1].id,
        supplierId: createdSuppliers[1].id,
        price: '12.99',
        minOrderQuantity: 50
      },
      {
        productId: createdProducts[2].id,
        supplierId: createdSuppliers[1].id,
        price: '15.99',
        minOrderQuantity: 25
      },
      {
        productId: createdProducts[3].id,
        supplierId: createdSuppliers[0].id,
        price: '149.99',
        minOrderQuantity: 5
      }
    ];

    const createdProductSuppliers = await db.insert(productSuppliers)
      .values(productSuppliersData)
      .returning();
    console.log('Created product-supplier relationships:', createdProductSuppliers);

    // Create sales records
    console.log('Creating sales records...');
    const salesData = [];
    const now = new Date();
    for (const product of createdProducts) {
      const numSales = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < numSales; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const quantity = Math.floor(Math.random() * 5) + 1;
        const saleDate = new Date(now);
        saleDate.setDate(saleDate.getDate() - daysAgo);
        
        salesData.push({
          productId: product.id,
          userId: user.id,
          quantity,
          revenue: (parseFloat(product.price) * quantity).toString(),
          saleDate: saleDate
        });
      }
    }

    const createdSales = await db.insert(sales).values(salesData).returning();
    console.log('Created sales records:', createdSales);

    // Create forecasts
    console.log('Creating forecasts...');
    const forecastsData = createdProducts.map(product => ({
      productId: product.id,
      userId: user.id,
      forecastDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      forecastQuantity: Math.floor(Math.random() * 50) + 20,
      confidence: '0.8'
    }));

    const createdForecasts = await db.insert(forecasts).values(forecastsData).returning();
    console.log('Created forecasts:', createdForecasts);

    // Create Shopify integration
    console.log('Creating Shopify integration...');
    const integrationData = {
      userId: user.id,
      platform: 'shopify',
      storeUrl: 'example-store.myshopify.com',
      accessToken: 'YOUR_ACCESS_TOKEN_HERE',
      isConnected: true,
      lastSynced: new Date()
    };

    const [createdIntegration] = await db.insert(integrations).values(integrationData).returning();
    console.log('Created Shopify integration:', createdIntegration);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Run the seed function
seedData()
  .then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  }); 