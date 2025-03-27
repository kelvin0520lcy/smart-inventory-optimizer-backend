import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = express.Router();

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
    
    // Generate a response
    console.log(`Processing message: "${message}"`);
    
    // Mock response
    const response = `I've processed your request about "${message}" and here's what I found...`;
    const functionCalls = [];
    
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
    timestamp: new Date().toISOString()
  });
});

export default router; 