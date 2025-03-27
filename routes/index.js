import express from 'express';
import aiAssistantRoutes from './ai-assistant.js';
import assistantRoutes from './assistant.js';
import aiAgentRoutes from './ai-agent.js';
import aiAnalysesRoutes from './ai-analyses.js';

const router = express.Router();

// Register routes
router.use('/ai-assistant', aiAssistantRoutes);
router.use('/assistant', assistantRoutes);
router.use('/ai-agent', aiAgentRoutes);
router.use('/ai-analyses', aiAnalysesRoutes);

// Simple health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router; 