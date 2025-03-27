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
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Database initialization error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
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
    success: true,
    message: 'API is working correctly',
    timestamp: new Date().toISOString()
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

(async () => {
  try {
    // Initialize database connection first
    console.log("Initializing database connection...");
    await initializeDatabase();
    
    // Register API routes
    registerRoutes(app);
    
    console.log("API routes registered");
    
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
      console.log(`Server running on port ${port}`);
      console.log(`API available at http://0.0.0.0:${port}/api`);
      console.log(`Test endpoint: http://0.0.0.0:${port}/api/status`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
