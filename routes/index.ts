import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create router
const router = express.Router();

// Import route modules with error handling
try {
  console.log("Loading AI assistant routes...");
  const aiAssistantRoutes = require('./ai-assistant.js').default;
  router.use('/ai-assistant', aiAssistantRoutes);
  console.log("✓ AI assistant routes loaded successfully");
} catch (error) {
  console.error("Failed to load AI assistant routes:", error.message);
  console.log("Will use fallback implementations instead");
}

try {
  console.log("Loading assistant routes...");
  const assistantRoutes = require('./assistant.js').default;
  router.use('/assistant', assistantRoutes);
  console.log("✓ Assistant routes loaded successfully");
} catch (error) {
  console.error("Failed to load assistant routes:", error.message);
  console.log("Will use fallback implementations instead");
}

// Simple health check endpoint that always works
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'API server is running correctly'
  });
});

export default router; 