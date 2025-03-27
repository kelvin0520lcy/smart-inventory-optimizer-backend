import express from 'express';
import aiAssistantRoutes from './ai-assistant.js';
import assistantRoutes from './assistant.js';

const router = express.Router();

// Register routes
router.use('/ai-assistant', aiAssistantRoutes);
router.use('/assistant', assistantRoutes);

// Simple health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router; 