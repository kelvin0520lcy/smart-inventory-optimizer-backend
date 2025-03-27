import { Router } from 'express';
import { generateChatResponse } from '../lib/openai';

const router = Router();

// Initialize conversation storage (in-memory for now, could be moved to a database)
const conversations: Record<string, { userId: number, messages: any[] }> = {};

// AI Assistant chat endpoint
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);
    const { message, conversationId = `conv_${Date.now()}` } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // For demo purposes, using a fixed user ID (user ID 2 is the demo user)
    // In production, get from auth
    const userId = 2;
    
    // Get or create conversation
    if (!conversations[conversationId]) {
      conversations[conversationId] = {
        userId,
        messages: []
      };
    }
    
    const conversation = conversations[conversationId];
    
    // Add user message to conversation history
    conversation.messages.push({
      role: 'user',
      content: message
    });
    
    // Generate AI response
    const response = await generateChatResponse(
      userId,
      message,
      conversation.messages
    );
    
    console.log('Generated AI response:', response);
    
    // Add AI response to conversation history
    conversation.messages.push({
      role: 'assistant',
      content: response.text
    });
    
    // Return response with conversation ID
    res.json({
      success: true,
      conversationId,
      response: response.text,
      functionCalls: response.functionCalls
    });
  } catch (error) {
    console.error('Error in AI assistant chat:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get conversation history
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!conversations[id]) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    res.json({
      success: true,
      conversation: conversations[id]
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List all conversations (limited info)
router.get('/conversations', async (req, res) => {
  try {
    const conversationList = Object.entries(conversations).map(([id, data]) => ({
      id,
      messageCount: data.messages.length,
      lastUpdated: data.messages.length > 0 ? 
        new Date().toISOString() : null // In a real app, would store timestamps
    }));
    
    res.json({
      success: true,
      conversations: conversationList
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add a simple test endpoint
router.get('/ping', (req, res) => {
  console.log('Ping endpoint called');
  res.json({
    success: true,
    message: 'Assistant API is working',
    timestamp: new Date().toISOString()
  });
});

export default router; 