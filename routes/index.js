import express from 'express';
import aiAssistantRoutes from './assistant.js';
import aiAgentRoutes from './ai-agent.js';

const router = express.Router();

// Register routes
router.use('/assistant', aiAssistantRoutes);
router.use('/ai-agent', aiAgentRoutes);

// Simple health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router; 