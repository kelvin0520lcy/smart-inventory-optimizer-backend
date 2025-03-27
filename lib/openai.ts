import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import OpenAI from 'openai';
import { storage, IStorage } from '../storage';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = resolve(__dirname, '../.env');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

console.log('OpenAI API key loaded successfully (first 10 chars):', process.env.OPENAI_API_KEY.substring(0, 10));
console.log('Full API key length:', process.env.OPENAI_API_KEY.length);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the system prompt for inventory management
const SYSTEM_PROMPT = `You are SIOA (Smart Inventory Optimization Assistant), an AI assistant specializing in inventory management.
Your role is to help users manage their inventory efficiently by:
1. Analyzing stock levels and suggesting reorder points
2. Providing sales forecasts and trend analysis
3. Recommending optimal order quantities
4. Monitoring supplier performance
5. Offering pricing optimization suggestions
6. Managing e-commerce platform integrations

Always be professional, concise, and data-driven in your responses.
When making recommendations, explain your reasoning and provide specific numbers when possible.`;

// Interface for chat message
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Interface for Product with sales data
interface Product {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  description: string | null;
  price: string;
  stockQuantity: number;
  lowStockThreshold: number | null;
  reorderPoint: number | null;
  createdAt: Date | null;
  platforms: string[] | null;
  platformIds: string[] | null;
  userId: number | null;
  totalSales?: number; // Make totalSales optional
}

// Interface for Sale
interface Sale {
  id: number;
  userId: number | null;
  productId: number | null;
  quantity: number;
  saleDate: string;
  platform: string | null;
  revenue: string | null;
}

// Interface for Supplier
interface Supplier {
  id: number;
  name: string;
  performance?: number;
  leadTime?: number;
  reliability?: string;
  lastDelivery?: Date;
}

// Interface for inventory context
interface InventoryContext {
  lowStockProducts: any[];
  bestSellingProducts: any[];
  salesTrends: any[];
  supplierPerformance: any[];
}

// Get inventory context for better responses
async function getInventoryContext(userId: number): Promise<InventoryContext> {
  try {
    const [
      lowStockProducts,
      products,
      sales,
      suppliers
    ] = await Promise.all([
      storage.getLowStockProducts(userId),
      storage.getProducts(userId) as Promise<Product[]>,
      storage.getSales(userId) as Promise<Sale[]>,
      storage.getSuppliers(userId) as Promise<Supplier[]>
    ]);

    // Calculate best selling products
    const bestSellingProducts = products
      .sort((a, b) => ((b.totalSales || 0) - (a.totalSales || 0)))
      .slice(0, 5);

    // Calculate sales trends (last 30 days vs previous 30 days)
    const salesTrends = calculateSalesTrends(sales);

    // Calculate supplier performance metrics
    const supplierPerformance = calculateSupplierPerformance(suppliers);

    return {
      lowStockProducts,
      bestSellingProducts,
      salesTrends,
      supplierPerformance
    };
  } catch (error) {
    console.error('Error getting inventory context:', error);
    return {
      lowStockProducts: [],
      bestSellingProducts: [],
      salesTrends: [],
      supplierPerformance: []
    };
  }
}

// Helper function to calculate sales trends
function calculateSalesTrends(sales: any[]) {
  // Group sales by product and calculate month-over-month growth
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentSales = sales.filter(sale => new Date(sale.date) >= thirtyDaysAgo);
  const previousSales = sales.filter(sale => 
    new Date(sale.date) >= sixtyDaysAgo && new Date(sale.date) < thirtyDaysAgo
  );

  const trends = [];
  const productSales = new Map();

  // Calculate recent sales by product
  for (const sale of recentSales) {
    const current = productSales.get(sale.productId) || 0;
    productSales.set(sale.productId, current + sale.quantity);
  }

  // Calculate previous sales and growth
  for (const [productId, recentQuantity] of Array.from(productSales.entries())) {
    const previousQuantity = previousSales
      .filter(sale => sale.productId === productId)
      .reduce((sum, sale) => sum + sale.quantity, 0);

    const growth = previousQuantity > 0 
      ? ((recentQuantity - previousQuantity) / previousQuantity) * 100 
      : 100;

    trends.push({
      productId,
      recentQuantity,
      previousQuantity,
      growth
    });
  }

  return trends.sort((a, b) => b.growth - a.growth);
}

// Helper function to calculate supplier performance
function calculateSupplierPerformance(suppliers: any[]) {
  return suppliers.map(supplier => ({
    id: supplier.id,
    name: supplier.name,
    performance: supplier.performance || 50,
    leadTime: supplier.leadTime || 7,
    reliability: supplier.reliability || 'Good',
    lastDelivery: supplier.lastDelivery
  }));
}

// Define function types for OpenAI
const AVAILABLE_FUNCTIONS = {
  placeOrder: {
    name: 'placeOrder',
    description: 'Place a new order for a product',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'number',
          description: 'The ID of the product to order'
        },
        quantity: {
          type: 'number',
          description: 'The quantity to order'
        },
        supplierId: {
          type: 'number',
          description: 'The ID of the supplier to order from'
        }
      },
      required: ['productId', 'quantity']
    }
  },
  fulfillOrder: {
    name: 'fulfillOrder',
    description: 'Mark an order as fulfilled and update stock quantity',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'number',
          description: 'The ID of the order to fulfill'
        }
      },
      required: ['orderId']
    }
  },
  updatePrice: {
    name: 'updatePrice',
    description: 'Update the price of a product',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'number',
          description: 'The ID of the product to update'
        },
        newPrice: {
          type: 'number',
          description: 'The new price for the product'
        },
        reason: {
          type: 'string',
          description: 'Reason for the price change'
        }
      },
      required: ['productId', 'newPrice']
    }
  },
  updateSupplier: {
    name: 'updateSupplier',
    description: 'Update supplier information',
    parameters: {
      type: 'object',
      properties: {
        supplierId: {
          type: 'number',
          description: 'The ID of the supplier to update'
        },
        updates: {
          type: 'object',
          description: 'The fields to update',
          properties: {
            name: { type: 'string' },
            leadTime: { type: 'number' },
            performance: { type: 'number' },
            reliability: { type: 'string' }
          }
        }
      },
      required: ['supplierId', 'updates']
    }
  }
};

// Function implementations
async function placeOrder(userId: number, args: any): Promise<string> {
  try {
    const { productId, quantity, supplierId } = args;
    
    // Get current product details
    const product = await storage.getProduct(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Create the order
    const order = await storage.createOrder(userId, {
      productId,
      quantity,
      supplierId,
      status: 'pending',
      orderDate: new Date()
    });

    return `Successfully placed order for ${quantity} units of product ${productId}. Order ID: ${order.id}. The stock will be updated when the order is fulfilled.`;
  } catch (error) {
    console.error('Error placing order:', error);
    throw new Error('Failed to place order');
  }
}

async function updatePrice(userId: number, args: any): Promise<string> {
  try {
    const { productId, newPrice, reason } = args;
    await storage.updateProduct(userId, productId, { price: newPrice.toString() });
    return `Successfully updated price to $${newPrice} for product ${productId}. Reason: ${reason || 'Not specified'}`;
  } catch (error) {
    console.error('Error updating price:', error);
    throw new Error('Failed to update price');
  }
}

async function updateSupplier(userId: number, args: any): Promise<string> {
  try {
    const { supplierId, updates } = args;
    await storage.updateSupplier(userId, supplierId, updates);
    return `Successfully updated supplier ${supplierId} with new information`;
  } catch (error) {
    console.error('Error updating supplier:', error);
    throw new Error('Failed to update supplier');
  }
}

async function fulfillOrder(userId: number, args: any): Promise<string> {
  try {
    const { orderId } = args;
    
    // Get the order
    const order = await storage.getOrder(orderId);
    if (!order || order.userId !== userId) {
      throw new Error('Order not found or unauthorized');
    }
    
    if (order.status === 'fulfilled') {
      return `Order ${orderId} is already fulfilled.`;
    }
    
    // Get the product
    const product = await storage.getProduct(order.productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Update the stock quantity - SUBTRACT instead of ADD
    const newStockQuantity = product.stockQuantity - order.quantity;
    if (newStockQuantity < 0) {
      throw new Error(`Cannot fulfill order: insufficient stock. Current stock: ${product.stockQuantity}, Order quantity: ${order.quantity}`);
    }
    
    await storage.updateProduct(userId, order.productId, { 
      stockQuantity: newStockQuantity 
    });
    
    // Update order status
    await storage.updateOrder(orderId, { status: 'fulfilled' });
    
    return `Order ${orderId} has been fulfilled. Stock updated from ${product.stockQuantity} to ${newStockQuantity} units.`;
  } catch (error) {
    console.error('Error fulfilling order:', error);
    throw new Error('Failed to fulfill order');
  }
}

// Modify the generateChatResponse function to include function calling
export async function generateChatResponse(
  userId: number,
  message: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  try {
    const context = await getInventoryContext(userId);
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { 
        role: 'system', 
        content: `Current inventory context:
- Low stock products: ${context.lowStockProducts.map(p => `${p.name} (${p.stockQuantity} units)`).join(', ') || 'None'}
- Best seller: ${context.bestSellingProducts[0]?.name || 'N/A'}
- Highest growth: ${context.salesTrends[0]?.growth.toFixed(1) || 0}% MoM
- Top supplier: ${context.supplierPerformance[0]?.name || 'N/A'} (${context.supplierPerformance[0]?.performance || 0}% reliability)`
      },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    console.log('Sending request to OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages as any[],
      functions: Object.values(AVAILABLE_FUNCTIONS),
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const response = completion.choices[0]?.message;

    // Handle function calls
    if (response?.function_call) {
      const functionName = response.function_call.name;
      const args = JSON.parse(response.function_call.arguments);
      
      let functionResponse;
      switch (functionName) {
        case 'placeOrder':
          functionResponse = await placeOrder(userId, args);
          break;
        case 'fulfillOrder':
          functionResponse = await fulfillOrder(userId, args);
          break;
        case 'updatePrice':
          functionResponse = await updatePrice(userId, args);
          break;
        case 'updateSupplier':
          functionResponse = await updateSupplier(userId, args);
          break;
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }

      // Get a final response from the AI about the action taken
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          ...messages,
          response,
          { role: 'function', name: functionName, content: functionResponse },
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return finalCompletion.choices[0]?.message?.content || 'Action completed successfully.';
    }

    return response?.content || 'I apologize, but I am unable to process your request at the moment.';
  } catch (error) {
    console.error('Error generating chat response:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return 'I apologize, but I encountered an error while processing your request. Please try again later.';
  }
}

// Export functions
export const openaiService = {
  generateChatResponse
}; 