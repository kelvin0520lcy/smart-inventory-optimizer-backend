import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
async function initializeServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    let initDb;
    try {
      const dbModule = await import('./db-pg.js');
      initDb = dbModule.initDb;
      await initDb();
      console.log('Database initialized successfully');
    } catch (dbError) {
      console.warn('Failed to initialize database:', dbError);
      console.log('Continuing with limited functionality...');
    }

    // Register routes
    try {
      const routes = (await import('./routes/index.js')).default;
      app.use('/api', routes);
      console.log('Routes registered successfully');
    } catch (routesError) {
      console.warn('Failed to load routes:', routesError);
      // Setup a basic routes if full routes fail to load
      app.use('/api/health', (req, res) => {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
      });
    }
    
    // Root path handler
    app.get('/', (req, res) => {
      res.json({
        status: 'OK',
        message: 'Smart Inventory API Server',
        timestamp: new Date().toISOString(),
        routes: ['/api/health', '/api/ai-agent', '/api/assistant/health']
      });
    });

    // Start background service
    try {
      console.log('Starting background service...');
      const { startBackgroundService } = await import('./services/background-service.js');
      startBackgroundService();
    } catch (serviceError) {
      console.warn('Failed to start background service:', serviceError);
    }

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initializeServer(); 