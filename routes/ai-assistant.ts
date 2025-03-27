import express from 'express';
import { 
  testOpenAIConnection, 
  processInventoryQuery, 
  getRestockRecommendations,
  getWebsiteNavigationHelp,
  getBestSellingProducts,
  getPriceOptimizations
} from '../lib/openai-assistant.js';
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

// Test OpenAI connection
router.get('/test-connection', async (req, res) => {
  try {
    const isConnected = await testOpenAIConnection();
    if (isConnected) {
      return res.status(200).json({ status: 'success', message: 'Successfully connected to OpenAI API' });
    }
    return res.status(500).json({ status: 'error', message: 'Failed to connect to OpenAI API' });
  } catch (error: any) {
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error testing OpenAI connection', 
      error: error.message 
    });
  }
});

// Process inventory queries
router.post('/query', async (req, res) => {
  try {
    console.log('Received query request:', req.body);
    
    const { query, message, inventoryData } = req.body;
    const queryText = query || message; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    // Get the inventory data or use an empty object if not provided
    const invData = inventoryData || {};
    
    // Process the query with OpenAI
    const response = await processInventoryQuery(queryText, invData);
    
    // Check if we have a complex response (with function calls)
    if (typeof response === 'object' && response !== null && 'content' in response) {
      return res.status(200).json({ 
        status: 'success', 
        data: response.content,
        functionCalls: 'functionCalls' in response ? response.functionCalls : [],
        hasActions: true
      });
    }
    
    // Simple text response
    return res.status(200).json({ status: 'success', data: response });
  } catch (error: any) {
    console.error('Error processing inventory query:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error processing inventory query', 
      error: error.message 
    });
  }
});

// Get restock recommendations
router.post('/restock-recommendations', async (req, res) => {
  try {
    console.log('Received restock recommendation request:', req.body);
    
    const { query, inventoryData, salesHistory, leadTimes, specificProduct } = req.body;
    
    if (!query) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    // Allow empty data for testing
    const invData = inventoryData || {};
    const salesData = salesHistory || {};
    const leadTimeData = leadTimes || {};
    
    const recommendations = await getRestockRecommendations(invData, salesData, leadTimeData, specificProduct);
    return res.status(200).json({ status: 'success', data: recommendations });
  } catch (error: any) {
    console.error('Error getting restock recommendations:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error getting restock recommendations', 
      error: error.message 
    });
  }
});

// Get website navigation help
router.post('/navigation-help', async (req, res) => {
  try {
    console.log('Received navigation help request:', req.body);
    
    const { query, message } = req.body;
    const queryText = query || message; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    const response = await getWebsiteNavigationHelp(queryText);
    return res.status(200).json({ status: 'success', data: response });
  } catch (error: any) {
    console.error('Error getting navigation help:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error getting navigation help', 
      error: error.message 
    });
  }
});

// Get best selling products
router.post('/best-selling', async (req, res) => {
  try {
    console.log('Received best selling products request:', req.body);
    
    const { query, message, inventoryData, salesHistory, productData } = req.body;
    const queryText = query || message || "Show best selling products"; // Default query
    
    // Use inventory data from either source
    const invData = productData || inventoryData || {};
    const salesData = salesHistory || {};
    
    // Process with specific best selling function
    const response = await getBestSellingProducts(queryText, invData, salesData);
    return res.status(200).json({ status: 'success', data: response });
  } catch (error: any) {
    console.error('Error getting best selling products:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error getting best selling products', 
      error: error.message 
    });
  }
});

// Get price optimization recommendations
router.post('/price-optimization', async (req, res) => {
  try {
    console.log('Received price optimization request:', req.body);
    
    const { query, message, inventoryData, salesHistory, marketData, specificProduct } = req.body;
    const queryText = query || message || "Recommend price optimizations"; // Default query
    
    // Use inventory data from either source
    const invData = inventoryData || {};
    const salesData = salesHistory || {};
    const marketInfo = marketData || {};
    
    // Process with the price optimization function
    const response = await getPriceOptimizations(queryText, invData, salesData, marketInfo, specificProduct);
    
    return res.status(200).json({ status: 'success', data: response });
  } catch (error: any) {
    console.error('Error getting price optimizations:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error getting price optimizations', 
      error: error.message 
    });
  }
});

// Universal endpoint that handles any query type
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);
    
    const { query, message, inventoryData, salesHistory, productData, specificProduct } = req.body;
    const queryText = query || message; // Accept either format
    
    if (!queryText) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }
    
    // Determine the type of query
    const lowerQuery = queryText.toLowerCase();
    
    // Extract potential product name from query if not already provided
    let productToAnalyze = specificProduct;
    if (!productToAnalyze) {
      const productNameMatch = queryText.match(/does\s+["']?([^"'?]+)["']?\s+need/i) || 
                            queryText.match(/adjust\s+(?:the\s+)?(?:price|pricing)\s+(?:for|of)\s+["']?([^"'?]+)["']?/i);
      if (productNameMatch) {
        productToAnalyze = productNameMatch[1].trim();
        console.log(`Extracted specific product from query: "${productToAnalyze}"`);
      }
    }
    
    // Combine all data
    const combinedData = {
      inventory: inventoryData || [],
      sales: salesHistory || [],
      products: productData || []
    };
    
    // Handle specific query types with specialized functions
    let response;
    
    if (lowerQuery.includes('best sell') || lowerQuery.includes('top product')) {
      // Use specialized best selling products function
      response = await getBestSellingProducts(
        queryText, 
        productData || inventoryData, 
        salesHistory
      );
    } else if (lowerQuery.includes('restock') || lowerQuery.includes('low stock') || lowerQuery.includes('need more')) {
      // Use restock recommendations function
      response = await getRestockRecommendations(
        combinedData.inventory,
        combinedData.sales,
        {}, // leadTimes
        productToAnalyze
      );
    } else if (lowerQuery.includes('price') || lowerQuery.includes('pricing') || lowerQuery.includes('optimize price')) {
      // Use price optimization function
      response = await getPriceOptimizations(
        queryText,
        combinedData.inventory,
        combinedData.sales,
        {}, // marketData
        productToAnalyze
      );
    } else if (lowerQuery.includes('how to') || lowerQuery.includes('navigate') || lowerQuery.includes('find')) {
      // Use website navigation help
      response = await getWebsiteNavigationHelp(queryText);
    } else {
      // Default to general inventory query
      response = await processInventoryQuery(queryText, combinedData);
    }
    
    // Check if we have a complex response (with function calls)
    if (typeof response === 'object' && response !== null && 'content' in response) {
      return res.status(200).json({ 
        status: 'success', 
        data: response.content,
        functionCalls: 'functionCalls' in response ? response.functionCalls : [],
        hasActions: true,
        conversationId: `chat_${Date.now()}`
      });
    }
    
    // Simple text response
    return res.status(200).json({ 
      status: 'success', 
      data: response,
      conversationId: `chat_${Date.now()}`
    });
  } catch (error: any) {
    console.error('Error processing chat query:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error processing chat query', 
      error: error.message 
    });
  }
});

// Simple mock endpoint that always works
router.post('/mock', async (req, res) => {
  try {
    console.log('Received mock request:', req.body);
    
    const { query, message } = req.body;
    const queryText = query || message || 'No query provided';
    
    // Generate a simple mock response based on the query
    let response = "I've analyzed your inventory data and found some interesting insights.";
    
    // Check for specific query types
    const lowerText = queryText.toLowerCase();
    
    if (lowerText.includes('restock') || lowerText.includes('low stock')) {
      response = "Based on your inventory data, these items need restocking:\n\n1. Wireless Headphones - 5 units left (CRITICAL)\n2. Smart Watch - 7 units left (LOW)\n3. Bluetooth Speaker - 4 units left (CRITICAL)";
    } else if (lowerText.includes('best sell') || lowerText.includes('top product')) {
      response = "Your top selling products this month are:\n\n1. Wireless Headphones - 58 units\n2. Smart LED Lamp - 42 units\n3. Portable Charger - 39 units";
    } else if (lowerText.includes('forecast')) {
      response = "Based on historical data, here's your sales forecast for next month:\n\n• Wireless Headphones: 63 units (+8.6%)\n• Smart LED Lamp: 47 units (+11.9%)\n• Portable Charger: 37 units (-5.1%)";
    } else if (lowerText.includes('optimize')) {
      response = "To optimize your inventory, I recommend:\n\n1. Increase Wireless Headphones stock by 50 units\n2. Reduce Leather Wallet stock by 15 units\n\nThis would improve your cash flow by approximately $2,345.";
    }
    
    return res.status(200).json({ 
      status: 'success', 
      data: response,
      conversationId: `mock_${Date.now()}`
    });
  } catch (error: any) {
    console.error('Error generating mock response:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Error generating mock response', 
      error: error.message 
    });
  }
});

// Direct OpenAI test endpoint
router.post('/openai/test', async (req, res) => {
  try {
    // Simple test to check if we can connect to OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'OpenAI API key not configured'
      });
    }
    
    // Attempt to make a simple completion request to OpenAI
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: req.body.prompt || 'Hello, is this connection working?' }
        ],
        max_tokens: 10  // Keep it minimal for testing
      });
      
      console.log('OpenAI test response:', completion);
      
      return res.status(200).json({
        success: true,
        message: 'OpenAI connection successful',
        response: completion.choices[0].message.content
      });
    } catch (openaiError: any) {
      console.error('Error connecting to OpenAI:', openaiError);
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to OpenAI API',
        error: openaiError.message
      });
    }
  } catch (error: any) {
    console.error('Server error testing OpenAI connection:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error testing OpenAI connection',
      error: error.message
    });
  }
});

export default router; 