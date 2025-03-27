import { Router } from 'express';

const router = Router();

// Simple test endpoint
router.get('/ping', (req, res) => {
  console.log('Assistant ping endpoint called');
  res.json({
    success: true,
    message: 'Assistant API is working',
    timestamp: new Date().toISOString()
  });
});

// Simple chat endpoint
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // For demo purposes, just return a simple response
    res.json({
      success: true,
      conversationId: `conv_${Date.now()}`,
      response: `You said: "${message}". This is a response from the assistant API.`,
      functionCalls: []
    });
  } catch (error) {
    console.error('Error in AI assistant chat:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 