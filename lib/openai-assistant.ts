import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Custom error function
const createError = (message: string, statusCode: number = 500) => {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
};

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test if we can connect to the OpenAI API
export const testOpenAIConnection = async (): Promise<boolean> => {
  try {
    console.log('Testing OpenAI connection...');
    
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return false;
    }
    
    // Make a simple API call to test connectivity
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    });
    
    console.log('OpenAI connection test succeeded:', response.choices[0].message);
    return true;
  } catch (error: any) {
    console.error('Error testing OpenAI connection:', error.message);
    
    // Log more detailed error information
    if (error.response) {
      console.error('OpenAI API Error Details:', {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
    }
    
    return false;
  }
};

// Create a system prompt for the AI assistant
const createSystemPrompt = () => {
  return `You are an advanced AI inventory management assistant responsible for:

1. Inventory Analysis:
   - Analyzing inventory data to identify items that need restocking
   - Detecting items below their reorder points
   - Highlighting critical low stock items with priority flags

2. Sales & Forecasting:
   - Analyzing sales history to identify top-selling products
   - Generating sales forecasts based on historical patterns
   - Recommending optimal inventory levels

3. Reordering & Supply Chain:
   - Calculating optimal order quantities based on demand, lead times, and costs
   - Tracking supplier performance and lead times
   - Recommending order actions with specific quantities

4. Price Optimization:
   - Analyzing price elasticity and competitive positioning
   - Recommending price adjustments to maximize profit margins
   - Identifying products where price changes would have the most impact

5. Website Guidance:
   - Helping users navigate the inventory management system
   - Providing step-by-step instructions for adding products, suppliers, etc.
   - Explaining dashboard features and reporting tools

IMPORTANT INSTRUCTIONS FOR DATA HANDLING:
1. When analyzing inventory data, you'll receive data in one of these formats:
   - Direct array of products: [{"id": "1", "name": "Product", "stockQuantity": 10, ...}]
   - Nested object: {"inventory": [...], "sales": [...], "products": [...]}

2. Even if sales data is missing or incomplete, ALWAYS provide a helpful response:
   - For best-selling products: If no sales data, rank based on stockQuantity or just list available products
   - For forecasting: If no historical data, make reasonable assumptions or provide general guidance
   - For restocking: Focus on products with low stockQuantity regardless of sales data
   - For price optimization: Consider current price, market position, and inventory levels

3. When no specific data is available, still provide actionable advice based on inventory management best practices.

When provided with inventory data, analyze it to identify:
- Products with stock levels below reorder points (flag as "needs restock")
- Critical items with less than 7 days of stock based on sales velocity (flag as "URGENT")
- Products with excess inventory that ties up capital (flag as "overstocked")

Use the following JSON format for processed inventory data:
{
  "needsRestock": [
    { "id": "product_id", "name": "Product Name", "currentStock": 5, "reorderPoint": 10, "recommendedOrder": 20 }
  ],
  "critical": [
    { "id": "product_id", "name": "Product Name", "currentStock": 1, "daysRemaining": 2, "recommendedOrder": 30 }
  ],
  "optimal": [
    { "id": "product_id", "name": "Product Name", "currentStock": 15, "status": "Good" }
  ],
  "overstocked": [
    { "id": "product_id", "name": "Product Name", "currentStock": 100, "optimalStock": 50, "excessValue": "$500" }
  ]
}

You have authorization to perform the following actions via API functions:
- Place purchase orders for products that need restocking
- Adjust reorder points based on sales velocity
- Update product prices based on market conditions
- Generate reports for inventory status

Aim to provide actionable insights that help optimize inventory, reduce stockouts, minimize excess inventory, and improve cash flow.
`;
};

// Main function to process user queries using OpenAI
export const processInventoryQuery = async (
  query: string, 
  inventoryData: any
): Promise<string | object> => {
  try {
    // Log the actual data received for debugging
    console.log('Processing inventory query with data:', {
      query,
      dataStructure: typeof inventoryData,
      hasInventory: inventoryData && inventoryData.inventory ? inventoryData.inventory.length : 0,
      hasSales: inventoryData && inventoryData.sales ? inventoryData.sales.length : 0,
      hasProducts: inventoryData && inventoryData.products ? inventoryData.products.length : 0,
      rawData: JSON.stringify(inventoryData).substring(0, 200) + '...' // Log the first 200 chars
    });
    
    // Create a context with inventory data
    const inventoryContext = inventoryData && Object.keys(inventoryData).length > 0 
      ? JSON.stringify(inventoryData)
      : "No inventory data provided";
    
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "place_order",
          description: "Place an order for products that need restocking",
          parameters: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "The product ID" },
                    name: { type: "string", description: "The product name" },
                    quantity: { type: "integer", description: "The quantity to order" }
                  },
                  required: ["id", "quantity"]
                }
              },
              supplier_id: { type: "string", description: "The supplier ID to order from (optional)" },
              urgent: { type: "boolean", description: "Whether this is an urgent order" }
            },
            required: ["products"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "adjust_reorder_point",
          description: "Adjust the reorder point for a product",
          parameters: {
            type: "object",
            properties: {
              product_id: { type: "string", description: "The product ID" },
              new_reorder_point: { type: "integer", description: "The new reorder point value" },
              reason: { type: "string", description: "The reason for adjusting the reorder point" }
            },
            required: ["product_id", "new_reorder_point"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "generate_inventory_report",
          description: "Generate a detailed inventory status report",
          parameters: {
            type: "object",
            properties: {
              report_type: { 
                type: "string", 
                enum: ["low_stock", "excess_inventory", "all_products", "sales_velocity"],
                description: "The type of report to generate" 
              },
              format: { 
                type: "string", 
                enum: ["json", "text", "csv"],
                description: "The output format of the report" 
              }
            },
            required: ["report_type"]
          }
        }
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: createSystemPrompt() },
        { role: 'user', content: `Here is the current inventory data: ${inventoryContext}` },
        { role: 'user', content: query }
      ],
      tools: tools,
      temperature: 0.7,
      max_tokens: 800
    });

    if (!response.choices || response.choices.length === 0) {
      throw createError('Failed to get a response from OpenAI', 500);
    }

    // Check if there's a function call
    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    
    // If there are tool calls, process them
    if (toolCalls) {
      console.log('AI assistant wants to call functions:', toolCalls);
      
      // Process each function call
      const results = await Promise.all(toolCalls.map(async (toolCall) => {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        // Store the function call result
        let result;
        
        // Execute the function
        switch (functionName) {
          case 'place_order':
            result = await handlePlaceOrder(functionArgs.products, functionArgs.supplier_id, functionArgs.urgent);
            break;
          case 'adjust_reorder_point':
            result = await handleAdjustReorderPoint(functionArgs.product_id, functionArgs.new_reorder_point, functionArgs.reason);
            break;
          case 'generate_inventory_report':
            result = await handleGenerateReport(functionArgs.report_type, functionArgs.format || 'text', inventoryData);
            break;
          default:
            result = { error: `Unknown function: ${functionName}` };
        }
        
        return {
          tool_call_id: toolCall.id,
          function_name: functionName,
          result: JSON.stringify(result)
        };
      }));
      
      // Get the assistant's response to the function results
      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: createSystemPrompt() },
          { role: 'user', content: `Here is the current inventory data: ${inventoryContext}` },
          { role: 'user', content: query },
          responseMessage,
          ...results.map(result => ({
            role: 'tool' as const,
            tool_call_id: result.tool_call_id,
            name: result.function_name,
            content: result.result
          }))
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      
      // Return the final response with function call results
      return {
        content: secondResponse.choices[0].message.content || 'No response generated',
        functionCalls: results
      };
    }

    // Return the standard response if no function calls
    return responseMessage.content || 'No response generated';
  } catch (error: any) {
    console.error('Error processing inventory query with OpenAI:', error);
    throw createError(`OpenAI API error: ${error.message}`, 500);
  }
};

// Helper function to handle placing orders
async function handlePlaceOrder(products: any[], supplierId?: string, urgent?: boolean): Promise<any> {
  try {
    console.log(`Placing order for ${products.length} products`, { supplierId, urgent });
    
    // Here we would normally call the database to place the actual order
    // For now, we'll simulate a successful order
    
    const orderId = `ORD_${Date.now()}`;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + (urgent ? 3 : 7));
    
    return {
      success: true,
      order_id: orderId,
      products_ordered: products,
      total_items: products.reduce((sum, p) => sum + p.quantity, 0),
      supplier_id: supplierId || 'default_supplier',
      priority: urgent ? 'URGENT' : 'STANDARD',
      status: 'PENDING',
      estimated_delivery: estimatedDelivery.toISOString().split('T')[0]
    };
  } catch (error: any) {
    console.error('Error placing order:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to handle adjusting reorder points
async function handleAdjustReorderPoint(productId: string, newReorderPoint: number, reason?: string): Promise<any> {
  try {
    console.log(`Adjusting reorder point for product ${productId} to ${newReorderPoint}`, { reason });
    
    // Here we would normally update the database
    // For now, we'll simulate a successful update
    
    return {
      success: true,
      product_id: productId,
      previous_reorder_point: 10, // This would come from the database
      new_reorder_point: newReorderPoint,
      reason: reason || 'AI assistant recommendation',
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Error adjusting reorder point:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to handle generating reports
async function handleGenerateReport(reportType: string, format: string, inventoryData: any): Promise<any> {
  try {
    console.log(`Generating ${reportType} report in ${format} format`);
    
    // Process the inventory data based on the report type
    let reportData;
    
    switch (reportType) {
      case 'low_stock':
        reportData = Array.isArray(inventoryData) 
          ? inventoryData.filter(item => item.stockQuantity <= (item.reorderPoint || 10))
          : [];
        break;
      case 'excess_inventory':
        reportData = Array.isArray(inventoryData)
          ? inventoryData.filter(item => item.stockQuantity > (item.optimalStock || item.reorderPoint * 3 || 50))
          : [];
        break;
      case 'all_products':
        reportData = inventoryData;
        break;
      case 'sales_velocity':
        // This would normally calculate sales velocity from sales data
        reportData = Array.isArray(inventoryData)
          ? inventoryData.map(item => ({ 
              ...item, 
              salesVelocity: Math.round(Math.random() * 10) // Simulated data
            }))
          : [];
        break;
      default:
        reportData = [];
    }
    
    // Format the report according to the requested format
    if (format === 'text') {
      // For text format, create a readable summary
      const summary = `${reportType.replace('_', ' ')} Report\n` +
                     `Generated: ${new Date().toISOString()}\n` +
                     `Items in report: ${reportData.length}\n\n` +
                     reportData.map((item: any) => 
                       `${item.name || 'Unnamed'}: ${item.stockQuantity || 0} in stock` + 
                       (item.reorderPoint ? ` (Reorder at: ${item.reorderPoint})` : '')
                     ).join('\n');
      
      return { 
        success: true, 
        report_type: reportType, 
        format: 'text', 
        content: summary,
        item_count: reportData.length
      };
    }
    
    // For other formats, return the raw data
    return { 
      success: true, 
      report_type: reportType, 
      format: format, 
      data: reportData,
      item_count: reportData.length
    };
  } catch (error: any) {
    console.error('Error generating report:', error);
    return { success: false, error: error.message };
  }
};

// Function to recommend restock values
export const getRestockRecommendations = async (
  inventoryData: any,
  salesHistory: any,
  leadTimes: any,
  specificProduct?: string
): Promise<any> => {
  try {
    // Create a comprehensive context with all relevant data
    const context = JSON.stringify({
      inventory: inventoryData && Object.keys(inventoryData).length > 0 ? inventoryData : { message: "No inventory data provided" },
      sales: salesHistory && Object.keys(salesHistory).length > 0 ? salesHistory : { message: "No sales data provided" },
      leadTimes: leadTimes && Object.keys(leadTimes).length > 0 ? leadTimes : { message: "No lead time data provided" },
      specificProduct: specificProduct || null
    });
    
    // Create a customized prompt based on whether we're asking about a specific product
    let promptContent = `Based on the following inventory, sales history, and lead time data, provide restock recommendations in JSON format. 
    Include productId, current quantity, recommended restock quantity, and brief reasoning:
    ${context}`;
    
    if (specificProduct) {
      promptContent = `I need information about whether the product "${specificProduct}" needs restocking.
      Based on the following inventory, sales history, and lead time data, analyze ONLY this specific product.
      If the product is found in the data, tell me whether it needs restocking and why.
      If the specific product is not found, please indicate that.
      
      Here is the data:
      ${context}`;
    }
    
    // Use GPT-4-Turbo for specific product queries to get more accurate results
    console.log(`Using gpt-3.5-turbo model for ${specificProduct ? 'specific product' : 'general'} restock query`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: createSystemPrompt() },
        { role: 'user', content: promptContent }
      ],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: specificProduct ? undefined : { type: "json_object" }
    });

    if (!response.choices || response.choices.length === 0) {
      throw createError('Failed to get restock recommendations from OpenAI', 500);
    }

    // Parse the JSON response if it's a general query, or return text for specific products
    const content = response.choices[0].message.content || '{}';
    return specificProduct ? content : JSON.parse(content);
  } catch (error: any) {
    console.error('Error getting restock recommendations:', error);
    throw createError(`OpenAI API error: ${error.message}`, 500);
  }
};

// Function to help with website navigation
export const getWebsiteNavigationHelp = async (
  query: string
): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `${createSystemPrompt()}
        You can assist users with navigating the inventory management website to:
        - View and manage orders
        - Adjust product prices
        - Add new suppliers
        - Add new products
        Provide clear, step-by-step instructions based on their request.` },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    if (!response.choices || response.choices.length === 0) {
      throw createError('Failed to get navigation help from OpenAI', 500);
    }

    return response.choices[0].message.content || 'No response generated';
  } catch (error: any) {
    console.error('Error getting website navigation help:', error);
    throw createError(`OpenAI API error: ${error.message}`, 500);
  }
};

// Function to handle best selling products query
export const getBestSellingProducts = async (
  query: string,
  inventoryData: any,
  salesData: any
): Promise<string | object> => {
  try {
    // Log available data
    console.log('Processing best selling products query with data:', {
      hasInventory: inventoryData ? (Array.isArray(inventoryData) ? inventoryData.length : 'object') : 'none',
      hasSales: salesData ? (Array.isArray(salesData) ? salesData.length : 'object') : 'none'
    });
    
    // Prepare data for OpenAI - clean and format it
    let cleanedInventory = inventoryData;
    let cleanedSales = salesData;
    
    // Create a structured context specifically for best selling analysis
    let dataContext = "Here is the available data:\n\n";
    
    // Add inventory data context
    if (inventoryData && Object.keys(inventoryData).length > 0) {
      dataContext += "Product Inventory Data:\n" + 
                    JSON.stringify(
                      Array.isArray(inventoryData) 
                        ? inventoryData.slice(0, 10).map(p => ({ 
                            id: p.id, 
                            name: p.name, 
                            stockQuantity: p.stockQuantity || p.stock || 0
                          }))
                        : inventoryData
                    ) + "\n\n";
    } else {
      dataContext += "No inventory data available.\n\n";
    }
    
    // Add sales data context
    if (salesData && Object.keys(salesData).length > 0) {
      dataContext += "Sales Data:\n" + 
                    JSON.stringify(
                      Array.isArray(salesData) 
                        ? salesData.slice(0, 10)
                        : salesData
                    );
    } else {
      dataContext += "No sales data available. Please rank products based on inventory levels as a fallback.";
    }
    
    // Create a specific prompt for best selling products analysis
    const bestSellingPrompt = `
You are an inventory analyst specializing in identifying best-selling products.
Based on the following data, identify the top selling products and provide insights.
If sales data is available, rank by sales volume/revenue. 
If only inventory data is available, make educated guesses based on stock levels (lower stock might indicate higher sales).
IMPORTANT: Always provide a helpful response even with limited data. Never say you can't answer.

${dataContext}

Provide a ranked list of the best-selling products with the following information for each:
1. Product name
2. Sales volume (if available) or estimated popularity
3. Current stock level (if available)
4. Brief analysis of why this product is performing well
5. Any recommendations for inventory management

Format your response in a clear, structured way with numbered items.`;
    
    // Call OpenAI with specific best selling products prompt
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: bestSellingPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 800
    });
    
    if (!response.choices || response.choices.length === 0) {
      throw createError('Failed to get best selling products from OpenAI', 500);
    }
    
    // Return the content
    return response.choices[0].message.content || 'No response generated';
  } catch (error: any) {
    console.error('Error getting best selling products:', error);
    throw createError(`OpenAI API error: ${error.message}`, 500);
  }
};

// Function to get price optimization recommendations
export const getPriceOptimizations = async (
  query: string,
  inventoryData: any,
  salesData: any,
  marketData: any = {},
  specificProduct?: string
): Promise<string | object> => {
  try {
    // Log available data
    console.log('Processing price optimization query with data:', {
      hasInventory: inventoryData ? (Array.isArray(inventoryData) ? inventoryData.length : 'object') : 'none',
      hasSales: salesData ? (Array.isArray(salesData) ? salesData.length : 'object') : 'none',
      hasMarket: marketData ? (Array.isArray(marketData) ? marketData.length : 'object') : 'none',
      specificProduct: specificProduct || 'none'
    });
    
    // Create a structured context for price optimization analysis
    let dataContext = "Here is the available data:\n\n";
    
    // Add inventory data context
    if (inventoryData && Object.keys(inventoryData).length > 0) {
      dataContext += "Product Inventory Data:\n" + 
                    JSON.stringify(
                      Array.isArray(inventoryData) 
                        ? inventoryData.slice(0, 10).map(p => ({ 
                            id: p.id, 
                            name: p.name, 
                            stockQuantity: p.stockQuantity || p.stock || 0,
                            price: p.price || p.currentPrice || 0,
                            cost: p.cost || p.unitCost || 0
                          }))
                        : inventoryData
                    ) + "\n\n";
    } else {
      dataContext += "No inventory data available.\n\n";
    }
    
    // Add sales data context
    if (salesData && Object.keys(salesData).length > 0) {
      dataContext += "Sales Data:\n" + 
                    JSON.stringify(
                      Array.isArray(salesData) 
                        ? salesData.slice(0, 10)
                        : salesData
                    ) + "\n\n";
    } else {
      dataContext += "No sales data available.\n\n";
    }
    
    // Add market data context if available
    if (marketData && Object.keys(marketData).length > 0) {
      dataContext += "Market Data:\n" + 
                    JSON.stringify(marketData) + "\n\n";
    } else {
      dataContext += "No market data available. Please make reasonable assumptions about the market.\n\n";
    }
    
    // Add specific product context if provided
    if (specificProduct) {
      dataContext += `Specific Product Query: "${specificProduct}"\n\n`;
      dataContext += "IMPORTANT: Focus your analysis ONLY on this specific product.\n";
    }
    
    // Create a specific prompt for price optimization analysis
    let priceOptimizationPrompt = `
You are a pricing strategy specialist for inventory management.
Based on the following data, provide price optimization recommendations with clear reasoning.
IMPORTANT: Always provide a helpful response even with limited data. Never say you can't answer.

${dataContext}`;

    if (specificProduct) {
      priceOptimizationPrompt += `
For the specific product "${specificProduct}", provide:
1. Current price (if available)
2. Whether a price adjustment is recommended
3. Recommended new price with percentage change (if adjustment is needed)
4. Detailed reasoning based on inventory levels, sales data, and market conditions
5. Estimated impact on sales volume and profit margins

If the product does not need price adjustment, explain why its current pricing is optimal.
If the specific product isn't found in the data, clearly state this fact.
`;
    } else {
      priceOptimizationPrompt += `
For each product that could benefit from price adjustment, include:
1. Product name and current price (if available)
2. Recommended new price with percentage change 
3. Detailed reasoning based on inventory levels, sales data, and market conditions
4. Estimated impact on sales volume and profit margins

If a product does not need price adjustment, explain why its current pricing is optimal.
Focus on data-driven recommendations that will maximize profitability.
`;
    }
    
    priceOptimizationPrompt += `
Format your response in a clear, readable structure with distinct sections for each product.`;
    
    // Use GPT-4-Turbo for specific product queries to get more accurate results
    console.log(`Using gpt-3.5-turbo model for ${specificProduct ? 'specific product' : 'general'} price optimization query`);
    
    // Call OpenAI with specific price optimization prompt
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: priceOptimizationPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 800
    });
    
    if (!response.choices || response.choices.length === 0) {
      throw createError('Failed to get price optimization recommendations from OpenAI', 500);
    }
    
    // Return the content
    return response.choices[0].message.content || 'No response generated';
  } catch (error: any) {
    console.error('Error getting price optimization recommendations:', error);
    throw createError(`OpenAI API error: ${error.message}`, 500);
  }
}; 