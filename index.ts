import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import path from 'path';
import cors from 'cors';
import { dirname } from 'path';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { createServer } from 'http';
import apiRoutes from './routes/index.js';
import { db, testConnection, initDb } from './db-pg.js';

// Helper functions to generate GPT-style responses
function generateGptStyleResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('best selling') || lowerMessage.includes('bestselling') || lowerMessage.includes('top products')) {
    return "Based on our sales data analysis, here are the current best-selling products:\n\n1. Premium Bluetooth Headphones - 58 units sold this month, generating $5,219.42 in revenue\n2. Smart LED Desk Lamp - 42 units sold, $1,679.58 revenue\n3. Organic Cotton T-shirt - 39 units sold, $974.61 revenue\n4. Wireless Charging Pad - 35 units sold, $1,224.65 revenue\n5. Stainless Steel Water Bottle - 33 units sold, $659.67 revenue\n\nNotably, Premium Bluetooth Headphones have remained our top seller for the third consecutive month, with a 12% increase in sales compared to the previous period. The Smart LED Desk Lamp has moved up from 4th position due to the recent marketing campaign.\n\nWould you like more detailed analytics on any specific product or category?";
  }
  
  if (lowerMessage.includes('forecast') || lowerMessage.includes('predict')) {
    return "Based on historical sales data, current trends, and seasonal factors, here's the sales forecast for the next 30 days:\n\n1. Premium Bluetooth Headphones: Expected 63 units (+8.6% vs. current month)\n2. Smart LED Desk Lamp: Expected 47 units (+11.9%)\n3. Organic Cotton T-shirt: Expected 37 units (-5.1%) - seasonal decline expected\n4. Wireless Charging Pad: Expected 41 units (+17.1%) - growth due to upcoming product compatibility\n5. Stainless Steel Water Bottle: Expected 29 units (-12.1%) - seasonal decline\n\nTotal predicted revenue: $10,863.27\nConfidence level: 89%\n\nNotable insights:\n• Electronics category expected to grow 14.3% overall\n• Apparel likely to see slight decline due to seasonal factors\n• Upcoming holiday period should boost gift-related items starting next month\n\nWould you like me to generate a detailed forecast report or adjust the forecast parameters?";
  }
  
  if (lowerMessage.includes('low stock') || lowerMessage.includes('inventory') || lowerMessage.includes('restocking')) {
    return "I've analyzed your current inventory levels against sales velocity and identified these items requiring attention:\n\n**Critical (Less than 7 days of supply):**\n1. Premium Bluetooth Headphones - 4 units remaining (2 days of supply)\n2. Wireless Charging Pad - 7 units remaining (5 days of supply)\n\n**Low (7-14 days of supply):**\n3. Organic Cotton T-shirt - 11 units remaining (8 days of supply)\n4. Smart LED Desk Lamp - 14 units remaining (10 days of supply)\n\n**Recommended Actions:**\n• Place immediate order for Premium Bluetooth Headphones (suggested quantity: 50)\n• Expedite existing Wireless Charging Pad order (currently in transit)\n• Schedule replenishment for Organic T-shirts within 5 days\n\nWould you like me to prepare purchase orders for any of these items or adjust the reorder points for better inventory management?";
  }
  
  if (lowerMessage.includes('optimize')) {
    return "Based on my analysis of your inventory data, sales velocity, and carrying costs, I recommend the following inventory optimization actions:\n\n**Increase Inventory:**\n1. Premium Bluetooth Headphones: Current stock 4 units → Increase by 50 units\n   Reason: High demand (58 units/month), high profit margin (42%), only 2 days of supply remaining\n2. Wireless Charging Pad: Current stock 7 units → Increase by 35 units\n   Reason: Growing demand trend (+17% forecast), limited supply chain options\n\n**Reduce Inventory:**\n1. Leather Wallet: Current stock 32 units → Reduce by 15 units (potential savings: $300)\n   Reason: 142 days of supply exceeds optimal levels, ties up $300 in working capital\n2. Decorative Throw Pillow: Current stock 25 units → Reduce by 12 units (potential savings: $180)\n   Reason: Seasonal decline expected, current stock exceeds 120 days of supply\n\n**Inventory Health Overview:**\n• Total excess inventory value: $4,256 (opportunity for $1,250 reduction)\n• Stockout risk items: 3 products (action required within 7 days)\n• Optimal inventory balance can free up $2,345 in working capital\n\nWould you like me to implement any of these recommendations or generate a detailed optimization report?";
  }
  
  // Default response
  return "I've analyzed your query about '" + message + "' and found some interesting insights. Based on current data, there are several factors to consider. Would you like me to provide more specific information about sales trends, inventory levels, or market forecasts related to this topic?";
}

function generateFunctionCallsIfNeeded(message: string): any[] {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('best selling') || lowerMessage.includes('bestselling') || lowerMessage.includes('top products')) {
    return [{
      name: 'analyzeProductPerformance',
      args: { timePeriod: '30days', sortBy: 'quantity' },
      result: JSON.stringify([
        {
          id: 1,
          name: 'Premium Bluetooth Headphones',
          category: 'Electronics',
          totalQuantitySold: 58,
          totalRevenue: 5219.42,
          stockQuantity: 4,
          turnoverRate: 14.5,
          daysOfSupply: 2,
          profitMargin: 0.42
        },
        {
          id: 2,
          name: 'Smart LED Desk Lamp',
          category: 'Electronics',
          totalQuantitySold: 42,
          totalRevenue: 1679.58,
          stockQuantity: 14,
          turnoverRate: 3.0,
          daysOfSupply: 10,
          profitMargin: 0.38
        },
        {
          id: 3,
          name: 'Organic Cotton T-shirt',
          category: 'Apparel',
          totalQuantitySold: 39,
          totalRevenue: 974.61,
          stockQuantity: 11,
          turnoverRate: 3.55,
          daysOfSupply: 8,
          profitMargin: 0.45
        }
      ])
    }];
  }
  
  if (lowerMessage.includes('low stock') || lowerMessage.includes('inventory') || lowerMessage.includes('restocking')) {
    return [{
      name: 'notifyLowStock',
      args: { urgency: 'high', thresholdDays: 14 },
      result: JSON.stringify([
        {
          id: 1,
          name: 'Premium Bluetooth Headphones',
          stockQuantity: 4,
          reorderPoint: 20,
          category: 'Electronics',
          price: '89.99',
          daysOfSupply: 2,
          recommendedOrderQuantity: 50
        },
        {
          id: 7,
          name: 'Wireless Charging Pad',
          stockQuantity: 7,
          reorderPoint: 15,
          category: 'Electronics',
          price: '34.99',
          daysOfSupply: 5,
          recommendedOrderQuantity: 35
        },
        {
          id: 3,
          name: 'Organic Cotton T-shirt',
          stockQuantity: 11,
          reorderPoint: 15,
          category: 'Apparel',
          price: '24.99',
          daysOfSupply: 8,
          recommendedOrderQuantity: 25
        }
      ])
    }];
  }
  
  // Return empty array for no function calls
  return [];
}

// Modern way to get __dirname in ESM
const __dirname = process.cwd();

// Environment detection
const isProd = process.env.NODE_ENV === 'production';
const dbType = isProd ? 'Supabase PostgreSQL' : 'Local PostgreSQL';

const app = express();
const httpServer = createServer(app);

// Initialize database connection
async function initializeDatabase() {
  try {
    // Make sure environment variables are properly loaded
    if (process.env.NODE_ENV === 'production') {
      console.log("Database mode: PRODUCTION");
    } else {
      console.log("Database mode: DEVELOPMENT");
    }
    
    console.log(`Using SSL: ${process.env.USE_SSL ? 'YES' : 'NO'}`);
    console.log(`Connection: postgres://${process.env.DB_USER}:****@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    // Initialize the database connection
    console.log("Initializing database connection...");
    await initDb();
    
    // Test the connection
    const connected = await testConnection();
    if (connected) {
      console.log(`✓ Successfully connected to ${dbType}`);
      return true;
    } else {
      console.error(`✗ Failed to connect to ${dbType}`);
      
      // In production, we want to fail if we can't connect
      if (isProd) {
        console.error("CRITICAL: Unable to connect to production database. Check environment variables.");
        // Don't exit in production, let the server start with direct implementations
        console.log("Continuing with direct route implementations...");
        return false;
      }
      
      // If development and can't connect to local database, try switching to Supabase
      if (!isProd) {
        console.log("Attempting to fall back to Supabase for development...");
        // Set production environment variables temporarily
        process.env.NODE_ENV = 'production';
        process.env.USE_SSL = 'true';
        
        // Reinitialize with new environment variables
        await initDb(); // Re-initialize with production settings
        
        // Try connecting again
        const fallbackConnected = await testConnection();
        if (fallbackConnected) {
          console.log("✓ Successfully connected to Supabase as fallback");
          return true;
        } else {
          console.error("✗ Failed to connect to Supabase fallback");
          console.log("Continuing with direct route implementations...");
          return false;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Database initialization error:', error instanceof Error ? error.message : String(error));
    console.log("Continuing with direct route implementations...");
    return false;
  }
}

// Main CORS middleware for all routes
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up session middleware
const MemorySessionStore = MemoryStore(session);
app.use(session({
  secret: process.env.SESSION_SECRET || 'inventory-management-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  store: new MemorySessionStore({
    checkPeriod: 86400000 // Clear expired sessions every 24h
  })
}));

// Serve favicon and static files
app.use(express.static(path.join(__dirname, '../client/public')));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  console.log(`${req.method} ${reqPath} - Request received`);
  
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${reqPath} ${res.statusCode} - Response sent in ${duration}ms`);
    
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  // Always include CORS headers directly
  res.header('Access-Control-Allow-Origin', 'https://c502-2001-e68-5438-6795-3957-dd38-31ed-4cc6.ngrok-free.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// Type augmentation for express-session
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Direct API test route
app.get('/api/status', (req, res) => {
  res.json({
    status: "OK",
    message: "Smart Inventory API Server",
    timestamp: new Date().toISOString(),
    routes: [
      "/api/health",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/verify",
      "/api/auth/profile",
      "/api/auth/logout",
      "/api/products",
      "/api/products/low-stock",
      "/api/products/:id",
      "/api/sales",
      "/api/sales/product/:productId",
      "/api/suppliers",
      "/api/suppliers/:id",
      "/api/forecasts",
      "/api/forecasts/:productId",
      "/api/forecasts/generate/:productId",
      "/api/forecasts/advanced/:productId",
      "/api/integrations",
      "/api/integrations/:platform",
      "/api/integrations/shopify/auth",
      "/api/integrations/shopify/refresh",
      "/api/integrations/shopify/sync",
      "/api/integrations/shopify/products",
      "/api/integrations/shopify/orders",
      "/api/integrations/shopify/test",
      "/api/integrations/shopify/token",
      "/api/integrations/cj-dropshipping",
      "/api/integrations/cj-dropshipping/products",
      "/api/dashboard",
      "/api/chatbot",
      "/api/ai-assistant/health",
      "/api/ai-assistant/query",
      "/api/ai-assistant/chat",
      "/api/assistant/health",
      "/api/assistant/chat"
    ]
  });
});

// Add a root endpoint that shows all routes
app.get('/', (req, res) => {
  res.json({
    status: "OK",
    message: "Smart Inventory API Server",
    timestamp: new Date().toISOString(),
    routes: [
      "/api/health",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/verify",
      "/api/auth/profile",
      "/api/auth/logout",
      "/api/products",
      "/api/products/low-stock",
      "/api/products/:id",
      "/api/sales",
      "/api/sales/product/:productId",
      "/api/suppliers",
      "/api/suppliers/:id",
      "/api/forecasts",
      "/api/forecasts/:productId",
      "/api/forecasts/generate/:productId",
      "/api/forecasts/advanced/:productId",
      "/api/integrations",
      "/api/integrations/:platform",
      "/api/integrations/shopify/auth",
      "/api/integrations/shopify/refresh",
      "/api/integrations/shopify/sync",
      "/api/integrations/shopify/products",
      "/api/integrations/shopify/orders",
      "/api/integrations/shopify/test",
      "/api/integrations/shopify/token",
      "/api/integrations/cj-dropshipping",
      "/api/integrations/cj-dropshipping/products",
      "/api/dashboard",
      "/api/chatbot",
      "/api/ai-assistant/health",
      "/api/ai-assistant/query",
      "/api/ai-assistant/chat",
      "/api/assistant/health",
      "/api/assistant/chat"
    ]
  });
});

// Direct assistant test routes
app.get('/api/assistant/ping', (req, res) => {
  console.log('Assistant ping endpoint called');
  res.json({
    success: true,
    message: 'Assistant API is working',
    timestamp: new Date().toISOString()
  });
});

// Direct assistant health endpoint
app.get('/api/assistant/health', (req, res) => {
  console.log('Assistant health endpoint called');
  res.json({
    success: true,
    status: 'OK',
    message: 'Assistant API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Direct assistant chat endpoint
app.post('/api/assistant/chat', (req, res) => {
  console.log('Assistant chat endpoint called:', req.body);
  const { message, conversationId } = req.body;
  
  if (!message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Message is required' 
    });
  }
  
  // Generate a response
  console.log(`Processing message: "${message}"`);
  
  const response = generateGptStyleResponse(message);
  const functionCalls = generateFunctionCallsIfNeeded(message);
  
  return res.json({
    success: true,
    conversationId: conversationId || `conv_${Date.now()}`,
    response,
    functionCalls
  });
});

// Direct AI assistant health endpoint
app.get('/api/ai-assistant/health', (req, res) => {
  console.log('AI Assistant health endpoint called');
  res.status(200).json({
    status: 'OK',
    message: 'AI Assistant API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Direct AI assistant query endpoint
app.post('/api/ai-assistant/query', (req, res) => {
  try {
    console.log('Received query request:', req.body);
    
    const { query, message } = req.body;
    const queryText = query || message; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    const response = generateGptStyleResponse(queryText);
    const functionCalls = generateFunctionCallsIfNeeded(queryText);
    
    return res.status(200).json({ 
      status: 'success', 
      data: response,
      functionCalls: functionCalls,
      hasActions: functionCalls.length > 0
    });
  } catch (error) {
    console.error('Error processing inventory query:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error processing inventory query', 
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Direct AI assistant chat endpoint
app.post('/api/ai-assistant/chat', (req, res) => {
  try {
    console.log('Received AI assistant chat request:', req.body);
    
    const { query, message } = req.body;
    const queryText = query || message; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    const response = generateGptStyleResponse(queryText);
    const functionCalls = generateFunctionCallsIfNeeded(queryText);
    
    return res.status(200).json({
      status: 'success',
      data: response,
      functionCalls: functionCalls || [],
      hasActions: functionCalls.length > 0
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error processing chat request',
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

// Direct chatbot endpoint (for compatibility)
app.post('/api/chatbot', (req, res) => {
  try {
    console.log('Received chatbot request:', req.body);
    
    const { message, query } = req.body;
    const queryText = message || query; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Message is required' });
    }
    
    const response = generateGptStyleResponse(queryText);
    const functionCalls = generateFunctionCallsIfNeeded(queryText);
    
    return res.status(200).json({
      status: 'success',
      response: response,
      functionCalls: functionCalls || [],
      hasActions: functionCalls.length > 0
    });
  } catch (error) {
    console.error('Error in chatbot endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error processing chatbot request',
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Special CORS-friendly test endpoint
app.options('/api/assistant/cors-test', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://c502-2001-e68-5438-6795-3957-dd38-31ed-4cc6.ngrok-free.app');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

app.post('/api/assistant/cors-test', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://c502-2001-e68-5438-6795-3957-dd38-31ed-4cc6.ngrok-free.app');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  console.log('CORS test endpoint called:', req.body);
  const { message } = req.body || {};
  
  if (!message) {
    return res.json({
      success: false,
      error: 'Message is required'
    });
  }
  
  return res.json({
    success: true,
    conversationId: `cors_${Date.now()}`,
    response: `CORS test successful! You sent: "${message}"`,
    functionCalls: []
  });
});

// Register API routes
app.use('/api', apiRoutes);

// Main API route as a fallback for when modular routes fail to load
app.get('/api/health', (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Smart Inventory API Server is healthy",
    timestamp: new Date().toISOString()
  });
});

// Error handling for routes that fail to load
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Continue running the server despite route loading errors
});

// Add direct implementations for key routes (products, suppliers, sales)
// These will work even if the modular routes fail to load

// Products - Low stock
app.get('/api/products/low-stock', async (req, res) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 10;
    
    // Simulated low stock products
    const lowStockProducts = [
      {
        id: 1,
        name: 'Premium Bluetooth Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        category: 'Electronics',
        stockQuantity: 4,
        price: 89.99,
        sku: 'BH-001',
        reorderPoint: 20
      },
      {
        id: 7,
        name: 'Wireless Charging Pad',
        description: 'Fast charging pad compatible with all Qi devices',
        category: 'Electronics',
        stockQuantity: 7,
        price: 34.99,
        sku: 'WC-007',
        reorderPoint: 15
      }
    ];
    
    return res.json(lowStockProducts);
  } catch (error) {
    console.error('Error in low-stock endpoint:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Products - All
app.get('/api/products', async (req, res) => {
  try {
    // Simulated product list
    const products = [
      {
        id: 1,
        name: 'Premium Bluetooth Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        category: 'Electronics',
        stockQuantity: 4,
        price: 89.99,
        sku: 'BH-001'
      },
      {
        id: 2,
        name: 'Smart LED Desk Lamp',
        description: 'Adjustable brightness desk lamp with color temperature control',
        category: 'Electronics',
        stockQuantity: 14,
        price: 39.99,
        sku: 'DL-002'
      },
      {
        id: 3,
        name: 'Organic Cotton T-shirt',
        description: 'Soft, comfortable t-shirt made of 100% organic cotton',
        category: 'Apparel',
        stockQuantity: 11,
        price: 24.99,
        sku: 'AT-003'
      }
    ];
    
    return res.json(products);
  } catch (error) {
    console.error('Error in products endpoint:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    // Simulated supplier list
    const suppliers = [
      {
        id: 1,
        name: 'ElectroTech Supplies',
        email: 'contact@electrotech.com',
        phone: '123-456-7890',
        address: '123 Tech Blvd, Electronics City, CA 94000',
        notes: 'Preferred supplier for all electronics'
      },
      {
        id: 2,
        name: 'Fashion Hub',
        email: 'orders@fashionhub.com',
        phone: '123-456-7891',
        address: '456 Fashion Ave, Style District, NY 10001',
        notes: 'Reliable supplier for apparel products'
      }
    ];
    
    return res.json(suppliers);
  } catch (error) {
    console.error('Error in suppliers endpoint:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Sales
app.get('/api/sales', async (req, res) => {
  try {
    // Simulated sales data
    const salesData = [
      {
        id: 1,
        productId: 1,
        quantity: 5,
        saleDate: '2025-03-20T14:55:00Z',
        totalPrice: 449.95,
        channel: 'online'
      },
      {
        id: 2,
        productId: 2,
        quantity: 3,
        saleDate: '2025-03-21T10:30:00Z',
        totalPrice: 119.97,
        channel: 'store'
      },
      {
        id: 3,
        productId: 3,
        quantity: 2,
        saleDate: '2025-03-22T16:20:00Z',
        totalPrice: 49.98,
        channel: 'online'
      }
    ];
    
    return res.json(salesData);
  } catch (error) {
    console.error('Error in sales endpoint:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Dashboard stats
app.get('/api/dashboard', async (req, res) => {
  try {
    // Simulated dashboard data
    const dashboardData = {
      totalProducts: 25,
      lowStockItems: 4,
      totalSales: 156,
      revenue: 12654.87,
      recentSales: [
        {
          id: 1,
          productName: 'Premium Bluetooth Headphones',
          quantity: 5,
          saleDate: '2025-03-20T14:55:00Z',
          totalPrice: 449.95
        },
        {
          id: 2,
          productName: 'Smart LED Desk Lamp',
          quantity: 3,
          saleDate: '2025-03-21T10:30:00Z',
          totalPrice: 119.97
        }
      ],
      topProducts: [
        {
          id: 1,
          name: 'Premium Bluetooth Headphones',
          totalSold: 58,
          revenue: 5219.42
        },
        {
          id: 2,
          name: 'Smart LED Desk Lamp',
          totalSold: 42,
          revenue: 1679.58
        }
      ]
    };
    
    return res.json(dashboardData);
  } catch (error) {
    console.error('Error in dashboard endpoint:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Specific CORS test endpoint for debugging
app.get('/api/cors-test', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', 'https://c502-2001-e68-5438-6795-3957-dd38-31ed-4cc6.ngrok-free.app');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  res.json({
    success: true,
    message: 'CORS test successful',
    timestamp: new Date().toISOString()
  });
});

(async () => {
  try {
    // Load environment variables explicitly at startup
    console.log("Loading environment variables...");
    if (process.env.NODE_ENV === 'production') {
      console.log("Running in production mode");
      // Print out important environment variables (hiding sensitive parts)
      console.log("DB_HOST:", process.env.DB_HOST);
      console.log("DB_NAME:", process.env.DB_NAME);
      console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✓ Set" : "✗ Missing");
      console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "✓ Set" : "✗ Missing");
    } else {
      console.log("Running in development mode");
    }
    
    // Initialize database connection first
    console.log("Initializing database connection...");
    const dbConnected = await initializeDatabase();
    
    if (!dbConnected) {
      console.warn("Failed to connect to database. Some features may not work properly.");
    }
    
    // Try to register API routes, but continue if it fails
    try {
      console.log("Registering API routes...");
      registerRoutes(app);
      console.log("API routes registered successfully");
    } catch (routeError) {
      console.error("Failed to register some API routes:", routeError);
      console.log("The server will continue with direct route implementations");
    }
    
    // Then set up static file serving
    if (process.env.NODE_ENV !== 'production') {
      // In development, use Vite's dev server
      console.log("Setting up Vite middleware for development");
      await setupVite(app, httpServer);
    } else {
      // In production, serve the built files
      console.log("Setting up static file serving for production");
      const distPath = path.resolve(__dirname, '../dist/public');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    // Error handling middleware should be last
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('Error:', err);
      res.status(status).json({ message });
    });

    const port = process.env.PORT || 5000;
    httpServer.listen(Number(port), '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${port}`);
      console.log(`API available at http://0.0.0.0:${port}/api`);
      console.log(`Test endpoint: http://0.0.0.0:${port}/api/status`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
