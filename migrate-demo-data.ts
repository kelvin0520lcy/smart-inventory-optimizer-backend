import { db } from './db';
import { 
  users, products, sales, suppliers, 
  productSuppliers, forecasts, integrations 
} from '@shared/schema';
import { MemStorage } from './storage';
import { storage as dbStorage } from './db/storage';

// Demo data
const memProducts = [
  {
    name: 'Wireless Headphones',
    sku: 'WH-2023-BLK',
    category: 'Electronics',
    description: 'High-quality wireless headphones with noise cancellation',
    price: '199.99',
    stockQuantity: 3,
    lowStockThreshold: 5,
    reorderPoint: 10,
    platforms: ['shopify'],
    platformIds: ['12345'],
    createdAt: new Date()
  },
  {
    name: 'Organic Cotton T-Shirt (M)',
    sku: 'OCT-M-WHT',
    category: 'Apparel',
    description: 'Medium-sized organic cotton t-shirt in white',
    price: '29.99',
    stockQuantity: 15,
    lowStockThreshold: 20,
    reorderPoint: 25,
    platforms: ['shopify'],
    platformIds: ['23456'],
    createdAt: new Date()
  },
  {
    name: 'Premium Water Bottle',
    sku: 'PWB-500-BLU',
    category: 'Lifestyle',
    description: '500ml insulated stainless steel water bottle',
    price: '34.99',
    stockQuantity: 8,
    lowStockThreshold: 12,
    reorderPoint: 7,
    platforms: ['shopify'],
    platformIds: ['34567'],
    createdAt: new Date()
  },
  {
    name: 'Smart Home Hub',
    sku: 'SHH-2023-V2',
    category: 'Electronics',
    description: 'Smart home control center with voice assistant',
    price: '129.99',
    stockQuantity: 12,
    lowStockThreshold: 15,
    reorderPoint: 10,
    platforms: ['shopify'],
    platformIds: ['45678'],
    createdAt: new Date()
  }
];

const memSuppliers = [
  {
    name: 'ElectroSupply Inc.',
    contactInfo: 'contact@electrosupply.com',
    performance: 95,
    leadTime: 7
  },
  {
    name: 'EcoTextiles Ltd.',
    contactInfo: 'orders@ecotextiles.com',
    performance: 88,
    leadTime: 14
  },
  {
    name: 'Global Gadgets Co.',
    contactInfo: 'support@globalgadgets.com',
    performance: 92,
    leadTime: 10
  }
];

const memSales = Array.from({ length: 246 }, (_, i) => ({
  productId: (i % 4) + 1,
  quantity: Math.floor(Math.random() * 10) + 1,
  saleDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
  revenue: ((Math.random() * 100) + 50).toFixed(2),
  platform: 'shopify'
}));

const memForecasts = memProducts.map(product => ({
  productId: 1, // We'll update this after products are created
  forecastDate: new Date(),
  forecastQuantity: Math.floor(Math.random() * 100) + 50,
  confidence: (Math.random() * 0.3 + 0.7).toString()
}));

const memIntegrations = [
  {
    platform: 'woocommerce',
    isConnected: true,
    apiKey: 'wc_key_123',
    apiSecret: 'wc_secret_123',
    storeUrl: 'https://demo-store.com',
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    lastSynced: new Date()
  },
  {
    platform: 'amazon',
    isConnected: true,
    apiKey: 'amzn_key_123',
    apiSecret: 'amzn_secret_123',
    storeUrl: 'https://amazon.com/seller',
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    lastSynced: new Date()
  },
  {
    platform: 'ebay',
    isConnected: true,
    apiKey: 'ebay_key_123',
    apiSecret: 'ebay_secret_123',
    storeUrl: 'https://ebay.com/store',
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    lastSynced: new Date()
  }
];

async function clearExistingData() {
  await db.delete(forecasts);
  await db.delete(sales);
  await db.delete(productSuppliers);
  await db.delete(products);
  await db.delete(suppliers);
  await db.delete(integrations);
  await db.delete(users);
}

async function migrateDemoData() {
  console.log('Starting demo data migration...');
  
  try {
    console.log('Clearing existing data...');
    await clearExistingData();

    console.log('Creating demo user...');
    const dbUser = await dbStorage.createUser({
      username: 'demo',
      password: 'demo123',
      fullName: 'Demo User',
      email: 'demo@example.com',
      plan: 'pro'
    });

    if (!dbUser) {
      throw new Error('Failed to create demo user');
    }

    // Create Shopify integration
    const shopifyIntegration = await dbStorage.createIntegration({
      userId: dbUser.id,
      platform: 'shopify',
      isConnected: true,
      storeUrl: 'stk7mw-zv.myshopify.com',
      accessToken: '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',
      apiKey: null,
      apiSecret: null,
      refreshToken: null,
      expiresAt: null,
      lastSynced: new Date()
    });
    console.log('Created Shopify integration:', shopifyIntegration);

    // Migrate products
    console.log(`Migrating ${memProducts.length} products...`);
    const createdProducts = [];
    for (const product of memProducts) {
      const createdProduct = await dbStorage.createProduct({
        ...product,
        userId: dbUser.id
      });
      if (createdProduct) {
        createdProducts.push(createdProduct);
      }
    }

    // Migrate suppliers
    console.log(`Migrating ${memSuppliers.length} suppliers...`);
    const createdSuppliers = [];
    for (const supplier of memSuppliers) {
      const createdSupplier = await dbStorage.createSupplier({
        ...supplier,
        userId: dbUser.id
      });
      if (createdSupplier) {
        createdSuppliers.push(createdSupplier);
      }
    }

    // Migrate sales using created product IDs
    console.log(`Migrating ${memSales.length} sales...`);
    for (let i = 0; i < memSales.length; i++) {
      const productIndex = i % createdProducts.length;
      const sale = memSales[i];
      await dbStorage.createSale({
        ...sale,
        userId: dbUser.id,
        productId: createdProducts[productIndex].id
      });
    }

    // Migrate forecasts using created product IDs
    console.log(`Migrating ${memForecasts.length} forecasts...`);
    for (let i = 0; i < memForecasts.length; i++) {
      const forecast = memForecasts[i];
      await dbStorage.createForecast({
        ...forecast,
        userId: dbUser.id,
        productId: createdProducts[i].id
      });
    }

    // Migrate integrations
    console.log(`Migrating ${memIntegrations.length} integrations...`);
    for (const integration of memIntegrations) {
      await dbStorage.createIntegration({
        ...integration,
        userId: dbUser.id
      });
    }

    console.log('Demo data migration completed successfully!');
  } catch (error) {
    console.error('Error during demo data migration:', error);
    throw error;
  }
}

migrateDemoData(); 