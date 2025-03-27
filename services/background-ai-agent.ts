import OpenAI from 'openai';
import { db } from '../db-pg.js';
import { products, aiAnalyses } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProductAnalysis {
  productId: number;
  name: string;
  currentStock: number;
  price: string;
  cost: string | null;
  lowStockThreshold: number | null;
  reorderPoint: number | null;
  category: string | null;
  lastUpdated: string | null;
}

async function analyzeProduct(product: ProductAnalysis) {
  const context = `
    Product: ${product.name}
    Current Stock: ${product.currentStock}
    Price: ${product.price}
    Cost: ${product.cost || 'Not specified'}
    Low Stock Threshold: ${product.lowStockThreshold}
    Reorder Point: ${product.reorderPoint}
    Category: ${product.category}
    Last Updated: ${product.lastUpdated}
  `;

  // Get price analysis
  const priceCompletion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert inventory management AI. Analyze the product data and provide price recommendations. Consider market conditions, competition, and historical data. Return a JSON object with 'recommendation' and 'newPrice' fields."
      },
      {
        role: "user",
        content: context
      }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  // Get stock analysis
  const stockCompletion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert inventory management AI. Analyze the product data and provide stock recommendations. Consider current stock levels, reorder points, and historical data. Return a JSON object with 'recommendation' and 'orderQuantity' fields."
      },
      {
        role: "user",
        content: context
      }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  // Get sales forecast
  const forecastCompletion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert inventory management AI. Analyze the product data and provide a sales forecast. Consider historical sales data, seasonal trends, and market conditions. Return a JSON object with 'forecast' and 'confidence' fields."
      },
      {
        role: "user",
        content: context
      }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return {
    productId: product.productId,
    priceAnalysis: JSON.parse(priceCompletion.choices[0].message.content || '{}'),
    stockAnalysis: JSON.parse(stockCompletion.choices[0].message.content || '{}'),
    forecastAnalysis: JSON.parse(forecastCompletion.choices[0].message.content || '{}'),
    timestamp: new Date().toISOString(),
  };
}

export async function runBackgroundAnalysis() {
  try {
    console.log('Starting background AI analysis run...');
    console.log('Checking for OpenAI API key:', process.env.OPENAI_API_KEY ? 'API key is set' : 'API key is missing');
    
    // Get all products from the database with explicit field selection
    console.log('Fetching products from database...');
    const allProducts = await db.select({
      productId: products.id,
      name: products.name,
      currentStock: products.stockQuantity,
      price: products.price,
      cost: products.cost,
      lowStockThreshold: products.lowStockThreshold,
      reorderPoint: products.reorderPoint,
      category: products.category,
      lastUpdated: products.updatedAt
    }).from(products);
    
    console.log(`Retrieved ${allProducts.length} products to analyze`);
    
    // Analyze each product
    console.log('Beginning analysis of products...');
    const analyses = await Promise.all(
      allProducts.map((product: ProductAnalysis) => analyzeProduct(product))
    );

    // Store the analyses in the database
    console.log('Storing analysis results in database...');
    await db.insert(aiAnalyses).values(analyses);

    // Log the analyses
    console.log('Background AI Analysis Results:', analyses);

    // Check for critical recommendations
    const criticalRecommendations = analyses.filter(analysis => {
      const stockAnalysis = analysis.stockAnalysis;
      return stockAnalysis.orderQuantity > 0 || 
             (stockAnalysis.recommendation && stockAnalysis.recommendation.toLowerCase().includes('urgent'));
    });

    if (criticalRecommendations.length > 0) {
      console.log('Critical Recommendations:', criticalRecommendations);
      // TODO: Send notifications for critical recommendations
    }

    return analyses;
  } catch (error) {
    console.error('Background AI Analysis Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
} 