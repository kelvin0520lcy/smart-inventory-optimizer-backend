import express from 'express';
import cors from 'cors';
import { initDb } from './db-pg.js';
import routes from './routes/index.js';
import { startBackgroundService } from './services/background-service.js';
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
    await initDb();
    console.log('Database initialized successfully');

    // Register routes
    app.use('/api', routes);
    
    // Root path handler
    app.get('/', (req, res) => {
      res.json({
        status: 'OK',
        message: 'Smart Inventory API Server',
        timestamp: new Date().toISOString(),
        routes: ['/api/health', '/api/ai-agent', '/api/ai-analyses', '/api/ai-assistant/health', '/api/assistant/health']
      });
    });

    // Start background AI service
    console.log('Starting background AI service...');
    startBackgroundService();

    // Add a test endpoint to manually trigger the AI analysis
    app.get('/api/ai-analysis/run', async (req, res) => {
      try {
        console.log('Manually triggering AI analysis run...');
        const { runBackgroundAnalysis } = await import('./services/background-ai-agent.js');
        const results = await runBackgroundAnalysis();
        res.json({
          status: 'success',
          message: 'AI analysis completed successfully',
          analysisCount: results.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error running manual AI analysis:', error);
        res.status(500).json({
          status: 'error',
          message: 'Failed to run AI analysis',
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

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