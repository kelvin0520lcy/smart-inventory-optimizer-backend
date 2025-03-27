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
    console.log("OpenAI client initialized successfully");
  } catch (error) {
    console.warn("Failed to initialize OpenAI client:", error.message);
    console.log("Routes will use mock responses instead");
  }
}

// Helper for generating mock responses
function generateMockResponse(message) {
  return `This is a simulated response to your message: "${message}". The actual AI assistant isn't available in this environment due to missing API keys.`;
}

// Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);
    
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    // Generate a response - either with OpenAI or mock
    console.log(`Processing message: "${message}"`);
    
    let response;
    let functionCalls = [];
    
    if (openai) {
      // Use actual OpenAI if available
      // This is simplified - in a real implementation, you'd use the assistant API
      response = "AI assistant response based on your query: " + message;
    } else {
      // Use mock response if OpenAI is not available
      response = generateMockResponse(message);
    }
    
    return res.json({
      success: true,
      conversationId: conversationId || `conv_${Date.now()}`,
      response,
      functionCalls
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process chat request',
      message: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Assistant API is healthy',
    timestamp: new Date().toISOString(),
    openaiAvailable: Boolean(openai)
  });
});

export default router; 