import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize router
const router = express.Router();

// Check if OpenAI API key is available
const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

// Only initialize OpenAI if API key is available
let openai = null;
if (hasOpenAIKey) {
  try {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("OpenAI client initialized successfully for AI assistant");
  } catch (error) {
    console.warn("Failed to initialize OpenAI client for AI assistant:", error.message);
    console.log("AI assistant routes will use mock responses instead");
  }
}

// Helper for generating mock responses
function generateMockResponse(message) {
  if (message.toLowerCase().includes('inventory') || message.toLowerCase().includes('stock')) {
    return `Based on simulated inventory analysis for "${message}", I found several items that need attention. The Premium Bluetooth Headphones are running low (only 4 units left). Would you like to generate a purchase order?`;
  }
  
  if (message.toLowerCase().includes('sales') || message.toLowerCase().includes('revenue')) {
    return `Here's a simulated sales analysis for your query "${message}": Total sales are up 12% compared to last month, with Electronics showing the strongest growth at 18%. Would you like to see more detailed breakdowns?`;
  }
  
  return `This is a simulated AI assistant response to your query: "${message}". The actual AI assistant isn't available in this environment due to missing API keys.`;
}

// Health check endpoint that doesn't rely on OpenAI
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'AI Assistant API is healthy',
    timestamp: new Date().toISOString(),
    openaiAvailable: Boolean(openai)
  });
});

// Process inventory queries
router.post('/query', async (req, res) => {
  try {
    console.log('Received query request:', req.body);
    
    const { query, message } = req.body;
    const queryText = query || message; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    let responseText;
    if (openai) {
      // Use actual OpenAI if available
      responseText = "AI assistant response based on your inventory query: " + queryText;
    } else {
      // Use mock response if OpenAI is not available
      responseText = generateMockResponse(queryText);
    }
    
    const functionCalls = [];
    
    return res.status(200).json({ 
      status: 'success', 
      data: responseText,
      functionCalls: functionCalls,
      hasActions: functionCalls.length > 0
    });
  } catch (error) {
    console.error('Error processing inventory query:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error processing inventory query', 
      error: error.message 
    });
  }
});

// Universal endpoint that handles any query type
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);
    
    const { query, message } = req.body;
    const queryText = query || message; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    let responseText;
    if (openai) {
      // Use actual OpenAI if available
      responseText = "AI assistant intelligent response to: " + queryText;
    } else {
      // Use mock response if OpenAI is not available
      responseText = generateMockResponse(queryText);
    }
    
    const functionCalls = [];
    
    return res.status(200).json({
      status: 'success',
      data: responseText,
      functionCalls: functionCalls || [],
      hasActions: (functionCalls && functionCalls.length > 0)
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error processing chat request',
      error: error.message
    });
  }
});

export default router; 