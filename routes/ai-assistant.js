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

// Health check endpoint that doesn't rely on OpenAI
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'AI Assistant API is healthy',
    timestamp: new Date().toISOString()
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
    
    // Mock response as we don't have the real implementation
    const response = {
      content: `I've processed your query about "${queryText}" and found some insights`,
      functionCalls: []
    };
    
    return res.status(200).json({ 
      status: 'success', 
      data: response.content,
      functionCalls: response.functionCalls,
      hasActions: true
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
    
    // Mock assistant response
    const response = {
      content: `I've processed your request about "${queryText}" and here's what I found...`,
      functionCalls: []
    };
    
    return res.status(200).json({
      status: 'success',
      data: response.content,
      functionCalls: response.functionCalls || [],
      hasActions: (response.functionCalls && response.functionCalls.length > 0)
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