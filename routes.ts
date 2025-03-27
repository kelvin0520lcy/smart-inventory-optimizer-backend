import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./db/storage";
import cors from 'cors';
import { 
  insertUserSchema, 
  insertProductSchema, 
  insertSaleSchema, 
  insertSupplierSchema, 
  insertProductSupplierSchema,
  insertForecastSchema,
  insertIntegrationSchema,
  ProductSupplier
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import fetch from 'node-fetch';
import crypto from 'crypto';
import express from "express";
import fs from "fs";
import path from "path";
import dotenv from 'dotenv';
import { createProductInPlatform } from './integrations';
import bcrypt from 'bcryptjs';
import { config } from './config';  // Import the config object instead of a specific constant
import { db } from "./db";
import { eq } from 'drizzle-orm';
import { forecasts, productSuppliers, sales } from '@shared/schema';
import { generateAdvancedForecast } from './lib/ml-forecast';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'SHOPIFY_REDIRECT_URI',
  'SHOPIFY_API_VERSION',
  'SHOPIFY_SCOPES'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Constants
const VALID_PLATFORMS = ['shopify', 'woocommerce', 'amazon', 'shopee', 'lazada', 'taobao'];
const {
  SHOPIFY_API_VERSION,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  SHOPIFY_REDIRECT_URI,
  SHOPIFY_SCOPES
} = process.env as {
  SHOPIFY_API_VERSION: string;
  SHOPIFY_CLIENT_ID: string;
  SHOPIFY_CLIENT_SECRET: string;
  SHOPIFY_REDIRECT_URI: string;
  SHOPIFY_SCOPES: string;
};

// Helper function to get user ID from session
const getUserIdFromSession = (req: express.Request, res: express.Response): number | null => {
  if (!req.session || !req.session.userId) {
    return null;
  }
  return req.session.userId;
};

// Simple function to handle common validation errors
function handleValidationError(err: unknown, res: Response) {
  if (err instanceof ZodError) {
    const validationError = fromZodError(err);
    return res.status(400).json({ 
      message: "Validation error", 
      errors: validationError.details 
    });
  }
  
  console.error("Server error:", err);
  return res.status(500).json({ message: "Internal server error" });
}

// Simple forecasting algorithm
function generateForecast(sales: any[], days = 30) {
  if (sales.length === 0) return 0;
  
  // Group sales by day
  const dailySales = sales.reduce((acc, sale) => {
    const date = new Date(sale.saleDate).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + sale.quantity;
    return acc;
  }, {});
  
  // Calculate average daily sales
  const totalDays = Object.keys(dailySales).length || 1;
  const totalQuantity = Object.values(dailySales).reduce((sum: number, qty: any) => sum + qty, 0);
  const averageDailySales = totalQuantity / totalDays;
  
  // Apply a simple growth factor (10% increase)
  const growthFactor = 1.1;
  
  // Return forecast for next period
  return Math.round(averageDailySales * days * growthFactor);
}

// Validate integration platform
function validatePlatform(platform: string): boolean {
  return VALID_PLATFORMS.includes(platform.toLowerCase());
}

async function validateCredentials(platform: string, apiKey: string, apiSecret: string, storeUrl?: string): Promise<boolean> {
  // Basic validation
  if (!apiKey || !apiSecret) {
    return false;
  }

  // Platform-specific validation
  switch (platform.toLowerCase()) {
    case 'shopify':
    case 'woocommerce':
      return Boolean(storeUrl && storeUrl.length > 0);
    case 'amazon':
      return apiKey.startsWith('AKIA'); // Basic AWS access key validation
    default:
      return true;
  }
}

// Add these functions after the validateCredentials function
async function validateShopifyStore(storeUrl: string): Promise<boolean> {
  try {
    // Normalize the store URL
    if (!storeUrl.startsWith('http')) {
      storeUrl = `https://${storeUrl}`;
    }
    
    // Remove trailing slash if present
    if (storeUrl.endsWith('/')) {
      storeUrl = storeUrl.slice(0, -1);
    }
    
    // Check if the store exists by making a request to the shop endpoint
    const response = await fetch(`${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/shop.json`);
    
    // If the store exists, we'll get a 401 Unauthorized (since we don't have credentials yet)
    // If the store doesn't exist, we'll get a different error
    return response.status === 401;
  } catch (error) {
    console.error('Error validating Shopify store:', error);
    return false;
  }
}

async function exchangeShopifyCodeForToken(code: string, storeUrl: string, apiKey?: string): Promise<any> {
  try {
    // Use the provided API key or temp secret, fallback to environment variables
    const clientId = apiKey || process.env.TEMP_SHOPIFY_API_KEY || SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.TEMP_SHOPIFY_SECRET || SHOPIFY_CLIENT_SECRET;
    
    // Clear temporary variables after using them
    delete process.env.TEMP_SHOPIFY_API_KEY;
    delete process.env.TEMP_SHOPIFY_SECRET;
    
    // Normalize the store URL
    if (!storeUrl.startsWith('http')) {
      storeUrl = `https://${storeUrl}`;
    }
    
    // Remove trailing slash if present
    if (storeUrl.endsWith('/')) {
      storeUrl = storeUrl.slice(0, -1);
    }
    
    const response = await fetch(`${storeUrl}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error exchanging Shopify code for token:', error);
    throw error;
  }
}

async function fetchShopifyProducts(storeUrl: string, accessToken: string): Promise<any[]> {
  try {
    const response = await fetch(`https://${storeUrl}/admin/api/2024-01/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    const data = await response.json() as { products: any[] };
    return data.products || [];
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    throw error;
  }
}

async function fetchShopifyOrders(storeUrl: string, accessToken: string): Promise<any[]> {
  try {
    const response = await fetch(`${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }
    
    const data = await response.json() as { orders: any[] };
    return data.orders || [];
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    throw error;
  }
}

async function fetchShopifyInventory(storeUrl: string, accessToken: string): Promise<any[]> {
  try {
    // First, get all inventory items
    const response = await fetch(`${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/inventory_items.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch inventory: ${response.statusText}`);
    }
    
    const data = await response.json() as { inventory_items: any[] };
    return data.inventory_items || [];
  } catch (error) {
    console.error('Error fetching Shopify inventory:', error);
    throw error;
  }
}

// Update the saveAccessTokenToFile function with better logging
function saveAccessTokenToFile(token: string, shop: string): void {
  try {
    const tokenData = {
      accessToken: token,
      shopUrl: shop,
      timestamp: new Date().toISOString()
    };
    
    // Create tokens directory if it doesn't exist
    const tokenDir = path.join(process.cwd(), 'tokens');
    if (!fs.existsSync(tokenDir)) {
      console.log(`Creating tokens directory: ${tokenDir}`);
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    
    // Save token to file
    const tokenFilePath = path.join(tokenDir, 'shopify_access_token.json');
    fs.writeFileSync(
      tokenFilePath,
      JSON.stringify(tokenData, null, 2),
      'utf8'
    );
    
    // Verify the file was written correctly
    if (fs.existsSync(tokenFilePath)) {
      const stats = fs.statSync(tokenFilePath);
      console.log(`✅ Token saved successfully! File size: ${stats.size} bytes`);
      console.log(`📁 Token location: ${tokenFilePath}`);
    } else {
      console.error(`❌ Failed to save token: File doesn't exist after writing`);
    }
  } catch (error) {
    console.error('❌ Error saving access token to file:', error);
  }
}

async function deleteShopifyProduct(storeUrl: string, accessToken: string, productId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${storeUrl}/admin/api/2024-01/products/${productId}.json`, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    return response.status === 200 || response.status === 204;
  } catch (error) {
    console.error('Error deleting Shopify product:', error);
    throw error;
  }
}

// Add this function after the existing helper functions
async function syncVendorAsSupplier(vendorName: string, userId: number, productId?: number, price?: string) {
  try {
    // Check if supplier already exists
    const suppliers = await storage.getSuppliers(userId);
    const existingSupplier = suppliers.find(s => s.name.toLowerCase() === vendorName.toLowerCase());
    
    let supplier;
    if (!existingSupplier) {
      // Create new supplier
      const supplierData = {
        name: vendorName,
        contactInfo: 'Auto-created from Shopify vendor',
        performance: 50, // Default performance
        leadTime: 7, // Default lead time in days
        userId
      };
      
      supplier = await storage.createSupplier(supplierData);
      console.log(`Created new supplier from vendor: ${vendorName}`);
    } else {
      supplier = existingSupplier;
    }

    // Create product-supplier relationship if productId is provided
    if (productId && supplier) {
      const productSupplierData = {
        productId,
        supplierId: supplier.id,
        price: price || null,
        minOrderQuantity: 1 // Default minimum order quantity
      };

      const existingProductSuppliers = await storage.getProductSuppliers(productId);
      const existingRelationship = existingProductSuppliers.find(
        ps => ps.supplierId === supplier.id
      );

      if (!existingRelationship) {
        const productSupplier = await storage.createProductSupplier(productSupplierData);
        console.log(`Created product-supplier relationship for product ${productId} and supplier ${supplier.id}`);
      }
    }
    
    return supplier;
  } catch (error) {
    console.error('Error syncing vendor as supplier:', error);
    return null;
  }
}

interface ShopifyProduct {
  product: {
    id: number;
    variants: Array<{
      id: number;
      price: string;
    }>;
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API prefix for all routes
  const apiPrefix = "/api";
  
  // Configure CORS with the cors package
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5000',
      'https://c502-2001-e68-5438-6795-3957-dd38-31ed-4cc6.ngrok-free.app',
      /\.ngrok-free\.app$/,  // Allow all ngrok URLs for development
      '*' // Allow all origins for testing purposes
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    exposedHeaders: ['Access-Control-Allow-Origin']
  }));
  
  // Add CORS preflight handler for complex requests
  app.options('*', cors());
  
  // Health check endpoint
  app.get(`${apiPrefix}/health`, (req, res) => {
    res.json({ status: "OK", timestamp: new Date() });
  });
  
  // User routes
  app.post(`${apiPrefix}/auth/login`, async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // For demo purposes, just compare passwords directly
      if (user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Set user in session
      if (req.session) {
        req.session.userId = user.id;
      }
      
      return res.json({ 
        id: user.id, 
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        plan: user.plan
      });
      
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/auth/register`, async (req, res) => {
    try {
      const userData = req.body;
      
      if (!userData.username || !userData.password || !userData.fullName || !userData.email) {
        return res.status(400).json({ 
          message: "All fields are required: username, password, fullName, email"
        });
      }
      
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      // Check if email is already in use
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already in use" });
      }
      
      // For demo purposes, we'll store the password directly
      const newUser = await storage.createUser(userData);
      
      // Set user in session
      if (req.session) {
        req.session.userId = newUser.id;
      }
      
      return res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        plan: newUser.plan
      });
      
    } catch (err) {
      console.error('Registration error:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Verify authentication status
  app.get(`${apiPrefix}/auth/verify`, async (req, res) => {
    try {
      // Check if user is authenticated via session
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get user data
      const user = await storage.getUserById(req.session.userId);
      
      if (!user) {
        // Clear invalid session
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      
      return res.json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt
      });
      
    } catch (err) {
      console.error('Auth verification error:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update user profile
  app.put(`${apiPrefix}/auth/profile`, async (req, res) => {
    try {
      // Check if user is authenticated via session
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { fullName, email } = req.body;
      
      // Basic validation
      if (!fullName || !email) {
        return res.status(400).json({ message: "Full name and email are required" });
      }
      
      // Get current user
      const currentUser = await storage.getUserById(req.session.userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if email is already in use by another user
      if (email !== currentUser.email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail && existingEmail.id !== currentUser.id) {
          return res.status(409).json({ message: "Email already in use by another account" });
        }
      }
      
      // Update user
      const updatedUser = await storage.updateUser(req.session.userId, {
        fullName,
        email
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user profile" });
      }
      
      // Return updated user data
      return res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        plan: updatedUser.plan,
        createdAt: updatedUser.createdAt
      });
      
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Logout route
  app.post(`${apiPrefix}/auth/logout`, (req, res) => {
    // Destroy the session
    if (req.session) {
      req.session.destroy(() => {
        res.status(200).json({ message: "Logged out successfully" });
      });
    } else {
      res.status(200).json({ message: "Logged out successfully" });
    }
  });
  
  // Product routes
  app.get(`${apiPrefix}/products`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      console.log(`Getting products for user ID: ${userId}`);
      const products = await storage.getProducts(userId);
      return res.json(products);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  // Low stock products route - MUST be before :id route
  app.get(`${apiPrefix}/products/low-stock`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get threshold from query params, default to 10 if not provided
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : undefined;
      
      if (req.query.threshold && (isNaN(threshold!) || threshold! < 0)) {
        return res.status(400).json({ 
          message: "Invalid threshold parameter. Must be a non-negative number." 
        });
      }
      
      const lowStockProducts = await storage.getLowStockProducts(userId, threshold);
      return res.json(lowStockProducts);
      
    } catch (err) {
      console.error('Error in low-stock endpoint:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Product by ID route - MUST be after specific routes
  app.get(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const product = await storage.getProductById(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Check if this product belongs to the authenticated user
      if (product.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      return res.json(product);
      
    } catch (err) {
      console.error('Error fetching product:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/products`, async (req, res) => {
    try {
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const productData = req.body;
      
      // Add the user ID to the product data
      productData.userId = userId;
      
      // Create product in local database
      const newProduct = await storage.createProduct(productData);
      
      // Check if we should sync with Shopify
      if (productData.syncWithShopify === true) {
        try {
          // Get the Shopify integration
          const integration = await storage.getIntegrationByPlatform(userId, 'shopify');
          
          if (integration && integration.accessToken && integration.storeUrl) {
            console.log(`Creating product ${newProduct.id} in Shopify...`);
            
            // Prepare product data for Shopify
            const shopifyProductData = {
              product: {
                title: newProduct.name,
                body_html: newProduct.description || '',
                vendor: newProduct.brand || 'Default Vendor',
                product_type: newProduct.category || 'Default Category',
                variants: [
                  {
                    price: newProduct.price,
                    sku: newProduct.sku,
                    inventory_quantity: newProduct.stockQuantity,
                    inventory_management: 'shopify'
                  }
                ]
              }
            };
            
            // Create product in Shopify
            const shopifyResponse = await fetch(
              `https://${integration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
              {
                method: 'POST',
                headers: {
                  'X-Shopify-Access-Token': integration.accessToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(shopifyProductData)
              }
            );
            
            if (!shopifyResponse.ok) {
              console.error(`Failed to create product in Shopify: ${shopifyResponse.statusText}`);
            } else {
              const shopifyData = await shopifyResponse.json() as ShopifyProduct;
              
              // Update local product with Shopify IDs
              const shopifyProductId = shopifyData.product.id.toString();
              const shopifyVariantId = shopifyData.product.variants[0].id.toString();
              
              // Update local product with Shopify information
              const updatedProduct = await storage.updateProduct(newProduct.id, {
                platforms: ['shopify'],
                platformIds: [shopifyProductId],
                shopifyProductId,
                shopifyVariantId
              });
              
              console.log(`Successfully created product in Shopify with ID: ${shopifyProductId}`);
              
              // Return the updated product
              return res.status(201).json(updatedProduct);
            }
          }
        } catch (shopifyError) {
          console.error('Error creating product in Shopify:', shopifyError);
          // Continue with local creation even if Shopify creation fails
        }
      }
      
      // Return the new product
      return res.status(201).json(newProduct);
      
    } catch (err) {
      console.error('Error creating product:', err);
      return handleValidationError(err, res);
    }
  });
  
  app.put(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      // Partial validation of update fields
      const updateData = req.body;
      
      // Get the existing product
      const existingProduct = await storage.getProduct(productId);
      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Update product in local database
      const updatedProduct = await storage.updateProduct(productId, updateData);
      
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // If the product is from Shopify and stock quantity changed, sync with Shopify
      if (
        existingProduct.platforms?.includes('shopify') && 
        existingProduct.platformIds?.length && 
        'stockQuantity' in updateData && 
        existingProduct.stockQuantity !== updateData.stockQuantity
      ) {
        try {
          // Get the user ID from session
          const userId = getUserIdFromSession(req, res);
          if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
          }
          
          // Get all integrations for this user
          const integrations = await storage.getIntegrations(userId);
          
          // Find the Shopify integration
          const shopifyIntegration = integrations.find(
            i => i.platform === 'shopify' && i.isConnected
          );
          
          if (shopifyIntegration && shopifyIntegration.accessToken && shopifyIntegration.storeUrl) {
            // First, fetch the product from Shopify to get the inventory_item_id
            console.log(`Fetching Shopify product data for ID: ${existingProduct.platformIds[0]}`);
            
            const shopifyProductUrl = `https://${shopifyIntegration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products/${existingProduct.platformIds[0]}.json`;
            
            const productResponse = await fetch(shopifyProductUrl, {
              headers: {
                'X-Shopify-Access-Token': shopifyIntegration.accessToken,
                'Content-Type': 'application/json'
              }
            });
            
            if (!productResponse.ok) {
              console.error(`Failed to fetch Shopify product: ${productResponse.statusText}`);
              // Continue with local update even if Shopify sync fails
            } else {
              const productData = await productResponse.json() as { product?: any };
              
              if (
                productData.product &&
                productData.product.variants &&
                productData.product.variants.length > 0
              ) {
                const variant = productData.product.variants[0];
                const inventoryItemId = variant.inventory_item_id;
                
                // Next, fetch locations to get the location ID
                const locationsResponse = await fetch(
                  `https://${shopifyIntegration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/locations.json`,
                  {
                    headers: {
                      'X-Shopify-Access-Token': shopifyIntegration.accessToken,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                if (!locationsResponse.ok) {
                  console.error(`Failed to fetch Shopify locations: ${locationsResponse.statusText}`);
                } else {
                  const locationsData = await locationsResponse.json() as { locations?: any[] };
                  
                  if (locationsData.locations && locationsData.locations.length > 0) {
                    const locationId = locationsData.locations[0].id;
                    
                    // Update inventory level in Shopify
                    const updateResponse = await fetch(
                      `https://${shopifyIntegration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`,
                      {
                        method: 'POST',
                        headers: {
                          'X-Shopify-Access-Token': shopifyIntegration.accessToken,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          inventory_item_id: inventoryItemId,
                          location_id: locationId,
                          available: updateData.stockQuantity
                        })
                      }
                    );
                    
                    if (!updateResponse.ok) {
                      console.error(`Failed to update Shopify inventory: ${updateResponse.statusText}`);
                    } else {
                      console.log(`Successfully updated Shopify inventory for product ${existingProduct.platformIds[0]} to ${updateData.stockQuantity}`);
                    }
                  }
                }
              }
            }
          }
        } catch (syncError) {
          console.error('Error syncing with Shopify:', syncError);
          // Continue with local update even if Shopify sync fails
        }
      }
      
      return res.json(updatedProduct);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.delete(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      console.log(`Starting delete process for product ID: ${productId}`);
      
      // Get the product before deleting it
      const product = await storage.getProduct(productId);
      
      if (!product) {
        console.log(`Product not found: ${productId}`);
        return res.status(404).json({ message: "Product not found" });
      }
      
      console.log(`Found product:`, product);
      
      // If it's a Shopify product, try to delete it from Shopify first
      if (product.platforms?.includes('shopify') && product.platformIds?.length) {
        try {
          // Get userId from session
          const userId = getUserIdFromSession(req, res);
          if (!userId) {
            console.log('User not authenticated, proceeding with local deletion only');
          } else {
            // Get the user's Shopify integration instead of using token file
            const integration = await storage.getIntegrationByPlatform(userId, 'shopify');
            
            if (!integration || !integration.accessToken || !integration.storeUrl) {
              console.log('Shopify integration not found or missing credentials, proceeding with local deletion only');
            } else {
              // First check if the product exists in Shopify
              console.log(`Checking if product ${product.platformIds[0]} exists in Shopify...`);
              
              try {
                const checkResponse = await fetch(
                  `https://${integration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products/${product.platformIds[0]}.json`,
                  {
                    headers: {
                      'X-Shopify-Access-Token': integration.accessToken,
                      'Content-Type': 'application/json'
                    }
                  }
                );

                if (checkResponse.ok) {
                  // Product exists in Shopify, try to delete it
                  console.log(`Product exists in Shopify, attempting deletion...`);
                  const success = await deleteShopifyProduct(integration.storeUrl, integration.accessToken, product.platformIds[0]);
                  if (!success) {
                    console.log('Failed to delete from Shopify, proceeding with local deletion only');
                  } else {
                    console.log(`Successfully deleted product from Shopify`);
                  }
                } else {
                  console.log(`Product not found in Shopify (status: ${checkResponse.status}), proceeding with local deletion only`);
                }
              } catch (checkError) {
                console.error('Error checking product existence in Shopify:', checkError);
                console.log('Proceeding with local deletion only');
              }
            }
          }
        } catch (shopifyError) {
          console.error('Error during Shopify deletion attempt:', shopifyError);
          // Continue with local deletion even if Shopify deletion fails
        }
      }

      // Use direct database queries to delete all related records
      // This ensures we delete records in the right order to satisfy foreign key constraints
      try {
        // First delete all forecasts for this product
        console.log(`Deleting forecasts for product ${productId}`);
        const forecasts = await storage.getForecastsByProduct(productId);
        for (const forecast of forecasts) {
          await storage.deleteForecast(forecast.id);
        }
        console.log(`Deleted ${forecasts.length} forecasts`);
        
        // Delete product-supplier relationships
        console.log(`Deleting product-supplier relationships for product ${productId}`);
        const suppliers = await storage.getProductSuppliers(productId);
        for (const supplier of suppliers) {
          await storage.deleteProductSupplier(supplier.id);
        }
        console.log(`Deleted ${suppliers.length} product-supplier relationships`);
        
        // Delete sales records for this product
        console.log(`Deleting sales records for product ${productId}`);
        const sales = await storage.getSalesByProduct(productId);
        for (const sale of sales) {
          await storage.deleteSale(sale.id);
        }
        console.log(`Deleted ${sales.length} sales records`);
        
        // Finally, delete the product itself
        console.log(`Deleting product ${productId}`);
        const deleted = await storage.deleteProduct(productId);
        
        if (!deleted) {
          console.log(`Product deletion failed for ID: ${productId}`);
          return res.status(404).json({ message: "Product not found or could not be deleted" });
        }
        
        console.log(`Successfully deleted product ${productId} and all related records`);
        
        return res.status(200).json({ 
          success: true, 
          message: "Product deleted successfully",
          productId
        });
      } catch (dbError) {
        console.error('Database error during deletion:', dbError);
        return res.status(500).json({ 
          message: "Error deleting product and related records", 
          error: dbError instanceof Error ? dbError.message : "Unknown database error"
        });
      }
      
    } catch (err) {
      console.error('Error in product delete endpoint:', err);
      return res.status(500).json({ 
        message: "Internal server error", 
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
  
  // Sales routes
  app.get(`${apiPrefix}/sales`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const sales = await storage.getSales(userId);
      return res.json(sales);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.get(`${apiPrefix}/sales/product/:productId`, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const sales = await storage.getSalesByProduct(productId);
      return res.json(sales);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.post(`${apiPrefix}/sales`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const saleData = insertSaleSchema.parse({
        ...req.body,
        userId
      });
      
      const newSale = await storage.createSale(saleData);
      return res.status(201).json(newSale);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  // Supplier routes
  app.get(`${apiPrefix}/suppliers`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      console.log(`Getting suppliers for user ID: ${userId}`);
      const suppliers = await storage.getSuppliers(userId);
      return res.json(suppliers);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.get(`${apiPrefix}/suppliers/:id`, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      
      if (isNaN(supplierId)) {
        return res.status(400).json({ message: "Invalid supplier ID" });
      }
      
      const supplier = await storage.getSupplierById(supplierId);
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      return res.json(supplier);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.post(`${apiPrefix}/suppliers`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const supplierData = insertSupplierSchema.parse({
        ...req.body,
        userId
      });
      
      const newSupplier = await storage.createSupplier(supplierData);
      return res.status(201).json(newSupplier);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.put(`${apiPrefix}/suppliers/:id`, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      
      if (isNaN(supplierId)) {
        return res.status(400).json({ message: "Invalid supplier ID" });
      }
      
      const supplier = await storage.getSupplierById(supplierId);
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      const updatedData = {
        ...req.body,
        id: supplierId,
        userId: supplier.userId
      };
      
      const updatedSupplier = await storage.updateSupplier(supplierId, updatedData);
      return res.json(updatedSupplier);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.delete(`${apiPrefix}/suppliers/:id`, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      
      if (isNaN(supplierId)) {
        return res.status(400).json({ message: "Invalid supplier ID" });
      }
      
      const supplier = await storage.getSupplierById(supplierId);
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      // Implementation notice: We would also need to handle dependent records like product_suppliers
      // in a real application, possibly by cascading the delete or preventing it if dependencies exist
      
      const deleted = await storage.deleteSupplier(supplierId);
      return res.json({ success: deleted });
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  // Product-Supplier routes
  app.get(`${apiPrefix}/product-suppliers/:productId`, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const productSuppliers = await storage.getProductSuppliers(productId);
      return res.json(productSuppliers);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.post(`${apiPrefix}/product-suppliers`, async (req, res) => {
    try {
      const { productId, supplierId, price, minOrderQuantity } = req.body;

      // Validate required fields
      if (!productId || !supplierId || !price) {
        return res.status(400).json({ 
          error: 'Missing required fields: productId, supplierId, and price are required' 
        });
      }

      // Check if relationship already exists
      const existingRelationships = await storage.getProductSuppliers(productId);
      const existingRelationship = existingRelationships.find(ps => ps.supplierId === supplierId);
      
      if (existingRelationship) {
        return res.status(400).json({
          error: 'Product-supplier relationship already exists'
        });
      }

      // Create product-supplier relationship
      const productSupplier = await storage.createProductSupplier({
        productId,
        supplierId,
        price,
        minOrderQuantity: minOrderQuantity || 1
      });

      // Get the product and supplier details
      const product = await storage.getProduct(productId);
      const supplier = await storage.getSupplierById(supplierId);

      // Update the product's vendor in Shopify if it exists there
      if (product?.platforms?.includes('shopify') && product.platformIds?.[0] && supplier) {
        try {
          const tokenFilePath = path.join(process.cwd(), 'tokens', 'shopify_access_token.json');
          if (fs.existsSync(tokenFilePath)) {
            const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
            if (tokenData.accessToken && tokenData.shopUrl) {
              const shopifyProductId = product.platformIds[0];
              const response = await fetch(
                `https://${tokenData.shopUrl}/admin/api/${SHOPIFY_API_VERSION}/products/${shopifyProductId}.json`,
                {
                  method: 'PUT',
                  headers: {
                    'X-Shopify-Access-Token': tokenData.accessToken,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    product: {
                      id: shopifyProductId,
                      vendor: supplier.name
                    }
                  })
                }
              );

              if (!response.ok) {
                console.error('Failed to update Shopify product vendor:', await response.text());
              }
            }
          }
        } catch (error) {
          console.error('Error updating Shopify product vendor:', error);
        }
      }

      return res.status(201).json(productSupplier);
    } catch (error) {
      console.error('Error creating product-supplier relationship:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create product-supplier relationship' 
      });
    }
  });
  
  // Forecast routes
  app.get(`${apiPrefix}/forecasts`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const forecasts = await storage.getForecasts(userId);
      return res.json(forecasts);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.get(`${apiPrefix}/forecasts/:productId`, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const forecasts = await storage.getForecastsByProduct(productId);
      return res.json(forecasts);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.post(`${apiPrefix}/forecasts`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const forecastData = insertForecastSchema.parse({
        userId,
        productId: req.body.productId,
        forecastDate: new Date(req.body.forecastDate), // Convert string to Date
        forecastQuantity: req.body.forecastQuantity,
        confidence: req.body.confidence
      });
      
      const forecast = await storage.createForecast(forecastData);
      
      return res.status(201).json(forecast);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  // Generate forecast based on sales history
  app.get(`${apiPrefix}/forecasts/generate/:productId`, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get sales history for the product
      const sales = await storage.getSalesByProduct(productId);
      
      // Generate forecast using simple algorithm
      const forecastQuantity = generateForecast(sales);
      
      // Create a forecast record
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + 30); // 30 days in the future
      
      const forecastData = {
        productId,
        userId,
        forecastDate: forecastDate.toISOString(), // Convert Date to ISO string
        forecastQuantity,
        confidence: "0.8" // Simple confidence level
      };
      
      const newForecast = await storage.createForecast(forecastData);
      return res.json(newForecast);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  // Advanced ML-based forecast endpoint
  app.get(`${apiPrefix}/forecasts/advanced/:productId?`, async (req, res) => {
    try {
      // Authenticate user
      const user = await authenticateUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { productId } = req.params;
      const { days = 30 } = req.query;
      
      // Parse days to number
      const forecastDays = parseInt(days as string, 10) || 30;
      
      // Fetch sales data
      let salesQuery = db.select().from(sales);
      
      if (productId) {
        salesQuery = salesQuery.where(eq(sales.productId, productId));
      }
      
      const salesData = await salesQuery.where(eq(sales.userId, user.id));
      
      if (salesData.length === 0) {
        return res.status(404).json({ 
          error: 'Not enough sales data for forecast',
          message: 'Add more sales data to generate a forecast'
        });
      }
      
      // Import the ML forecast function dynamically to prevent errors if the file doesn't exist
      try {
        const { generateAdvancedForecast } = await import('./lib/ml-forecast');
        
        // Generate forecast
        const forecast = generateAdvancedForecast(
          salesData.map(sale => ({
            date: new Date(sale.saleDate),
            quantity: sale.quantity,
            revenue: sale.revenue || 0
          })),
          forecastDays
        );
        
        // If product ID is provided, store the forecast
        if (productId) {
          try {
            const now = new Date();
            
            await db.insert(forecasts).values({
              id: uuidv4(),
              userId: user.id,
              productId,
              algorithm: 'ml-holtwinters',
              createdAt: now,
              forecastData: JSON.stringify(forecast)
            });
          } catch (storageError) {
            console.error('Error storing forecast:', storageError);
            // Continue even if storage fails
          }
        }
        
        return res.json({
          forecast,
          metadata: {
            algorithm: 'ML-enhanced Holt-Winters',
            productId: productId || 'all',
            generatedAt: new Date().toISOString(),
            dataPoints: salesData.length
          }
        });
      } catch (importError) {
        console.error('Error importing ML forecast module:', importError);
        return res.status(500).json({ 
          error: 'Advanced forecasting unavailable',
          message: 'The ML forecasting module could not be loaded'
        });
      }
    } catch (error) {
      console.error('Error generating advanced forecast:', error);
      return res.status(500).json({ 
        error: 'Failed to generate forecast',
        message: error.message
      });
    }
  });
  
  // Integration routes
  app.get(`${apiPrefix}/integrations`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const integrations = await storage.getIntegrations(userId);
      return res.json(integrations);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.get(`${apiPrefix}/integrations/:platform`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const platform = req.params.platform;
      
      
      const integration = await storage.getIntegrationByPlatform(userId, platform);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      return res.json(integration);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.post(`${apiPrefix}/integrations`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { platform, apiKey, apiSecret, storeUrl } = req.body;

      // Validate platform
      if (!validatePlatform(platform)) {
        return res.status(400).json({ 
          message: `Invalid platform. Supported platforms are: ${VALID_PLATFORMS.join(', ')}` 
        });
      }

      // Validate credentials
      if (!await validateCredentials(platform, apiKey, apiSecret, storeUrl)) {
        return res.status(400).json({ 
          message: 'Invalid credentials. Please check your API key, secret, and store URL (if required).' 
        });
      }
      
      const integrationData = insertIntegrationSchema.parse({
        ...req.body,
        userId
      });
      
      // Check if integration already exists
      const existingIntegration = await storage.getIntegrationByPlatform(userId, integrationData.platform);
      
      if (existingIntegration) {
        const updated = await storage.updateIntegration(existingIntegration.id, integrationData);
        return res.json(updated);
      }
      
      const newIntegration = await storage.createIntegration(integrationData);
      return res.status(201).json(newIntegration);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  app.put(`${apiPrefix}/integrations/:id`, async (req, res) => {
    try {
      const integrationId = parseInt(req.params.id);
      
      if (isNaN(integrationId)) {
        return res.status(400).json({ message: "Invalid integration ID" });
      }
      
      const updateData = req.body;
      
      const updatedIntegration = await storage.updateIntegration(integrationId, updateData);
      
      if (!updatedIntegration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      return res.json(updatedIntegration);
      
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  // Dashboard data
  app.get(`${apiPrefix}/dashboard`, async (req: Request, res) => {
    try {
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Retrieve actual data from database
      const products = await storage.getProducts(userId);
      const lowStockProducts = await storage.getLowStockProducts(userId);
      const outOfStockCount = products.filter(p => p.stockQuantity === 0).length;
      const integrations = await storage.getIntegrations(userId);

      // Get ALL sales data for analysis
      const salesData = await storage.getSales(userId);
      
      // Get forecasts
      const forecastData = await storage.getForecasts(userId);
      
      // Calculate 30-day metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const last30DaysSales = salesData.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        return saleDate >= thirtyDaysAgo;
      });
      
      const salesValue = last30DaysSales.reduce((total, sale) => {
        return total + parseFloat(sale.revenue || '0');
      }, 0).toFixed(2);
      
      // Generate data-driven alerts based on actual inventory, sales, and forecast data
      const alerts = [];
      const now = new Date();
      
      // 1. Critical stock alerts - items at or below reorder point
      const criticalStockItems = products.filter(p => 
        p.stockQuantity <= (p.reorderPoint || 5) && p.stockQuantity > 0
      );
      
      criticalStockItems.forEach(product => {
        alerts.push({
          id: uuidv4(),
          type: "critical",
          message: `${product.name} has reached critical stock level (${product.stockQuantity} left, reorder point: ${product.reorderPoint || 5}).`,
          product: product,
          timestamp: now,
          priority: 1  // Highest priority
        });
      });
      
      // 2. Out of stock alerts
      const outOfStockItems = products.filter(p => p.stockQuantity === 0);
      
      outOfStockItems.forEach(product => {
        alerts.push({
          id: uuidv4(),
          type: "critical",
          message: `${product.name} is out of stock! Immediate restocking required.`,
          product: product,
          timestamp: now,
          priority: 1  // Same high priority as critical
        });
      });
      
      // 3. Price optimization recommendations based on sales velocity
      const productsWithSales = products.filter(product => {
        return salesData.some(sale => sale.productId === product.id);
      });
      
      // Analyze products with sufficient sales history
      productsWithSales.forEach(product => {
        const productSales = salesData.filter(sale => sale.productId === product.id);
        
        // Skip products with insufficient sales data
        if (productSales.length < 3) return;
        
        // Calculate sales velocity (units sold per day)
        const oldestSaleDate = new Date(Math.min(...productSales.map(s => new Date(s.saleDate).getTime())));
        const newestSaleDate = new Date(Math.max(...productSales.map(s => new Date(s.saleDate).getTime())));
        const daysBetween = Math.max(1, (newestSaleDate.getTime() - oldestSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalUnitsSold = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
        const salesVelocity = totalUnitsSold / daysBetween;
        
        // High demand products that could be priced higher
        if (salesVelocity > 1 && product.stockQuantity > (product.reorderPoint || 5) * 2) {
          const increase = Math.min(15, Math.round(salesVelocity * 5)); // Calculate suggested percentage increase
          
          alerts.push({
            id: uuidv4(),
            type: "price",
            message: `Consider increasing the price of '${product.name}' by ${increase}% based on strong demand (${salesVelocity.toFixed(1)} units/day).`,
            product: product,
            timestamp: now,
            priority: 3
          });
        }
        
        // Low demand products that might need price reduction
        if (salesVelocity < 0.2 && product.stockQuantity > (product.reorderPoint || 5) * 3) {
          const decrease = Math.min(25, Math.round((1 / salesVelocity) * 5)); // Calculate suggested percentage decrease
          
          alerts.push({
            id: uuidv4(),
            type: "price",
            message: `Consider decreasing the price of '${product.name}' by ${decrease}% to increase sales velocity (currently ${salesVelocity.toFixed(1)} units/day).`,
            product: product,
            timestamp: now,
            priority: 3
          });
        }
      });
      
      // 4. Sales trend alerts - compare recent sales to historical patterns
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);
      
      productsWithSales.forEach(product => {
        const productSales = salesData.filter(sale => sale.productId === product.id);
        const productForecasts = forecastData.filter(f => f.productId === product.id);
        
        // Recent sales for this product
        const recentSales = productSales.filter(sale => new Date(sale.saleDate) >= last7Days);
        
        if (recentSales.length === 0) return;
        
        // Calculate recent vs. historical sales velocity
        const recentQuantity = recentSales.reduce((sum, sale) => sum + sale.quantity, 0);
        const recentDays = 7; // Last 7 days
        const recentVelocity = recentQuantity / recentDays;
        
        // All historical sales excluding recent
        const historicalSales = productSales.filter(sale => new Date(sale.saleDate) < last7Days);
        
        // Skip if not enough historical data
        if (historicalSales.length < 5) return;
        
        const oldestHistoricalDate = new Date(Math.min(...historicalSales.map(s => new Date(s.saleDate).getTime())));
        const newestHistoricalDate = new Date(Math.max(...historicalSales.map(s => new Date(s.saleDate).getTime())));
        const historicalDays = Math.max(1, (newestHistoricalDate.getTime() - oldestHistoricalDate.getTime()) / (1000 * 60 * 60 * 24));
        const historicalQuantity = historicalSales.reduce((sum, sale) => sum + sale.quantity, 0);
        const historicalVelocity = historicalQuantity / historicalDays;
        
        // Significant increase in sales velocity
        if (recentVelocity > historicalVelocity * 1.5) {
          const percentIncrease = Math.round((recentVelocity / historicalVelocity - 1) * 100);
          
          alerts.push({
            id: uuidv4(),
            type: "trend",
            message: `${product.name} is selling ${percentIncrease}% faster than historical average. Consider increasing next order by ${Math.min(100, percentIncrease)}%.`,
            product: product,
            timestamp: now,
            priority: 2
          });
          
          // If forecast exists but doesn't account for this trend, add another alert
          if (productForecasts.length > 0) {
            const latestForecast = productForecasts.reduce((latest, f) => 
              new Date(f.createdAt) > new Date(latest.createdAt) ? f : latest
            , productForecasts[0]);
            
            const forecastDate = new Date(latestForecast.createdAt);
            const daysSinceForecast = Math.round((now.getTime() - forecastDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceForecast > 14) {
              alerts.push({
                id: uuidv4(),
                type: "trend",
                message: `${product.name} forecast is ${daysSinceForecast} days old and doesn't reflect recent ${percentIncrease}% sales increase. Update forecast.`,
                product: product,
                timestamp: now,
                priority: 2
              });
            }
          }
        }
        
        // Significant decrease in sales velocity
        if (recentVelocity < historicalVelocity * 0.6) {
          const percentDecrease = Math.round((1 - recentVelocity / historicalVelocity) * 100);
          
          alerts.push({
            id: uuidv4(),
            type: "trend",
            message: `${product.name} is selling ${percentDecrease}% slower than historical average. Consider reducing next order or running promotions.`,
            product: product,
            timestamp: now,
            priority: 2
          });
        }
      });
      
      // 5. Inventory optimization recommendations
      const excessInventoryItems = products.filter(product => {
        // Find product sales to calculate inventory turn rate
        const productSales = salesData.filter(sale => sale.productId === product.id);
        
        // Skip products with no sales
        if (productSales.length === 0) return false;
        
        // Calculate average daily sales
        const totalSoldQuantity = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
        const oldestSaleDate = new Date(Math.min(...productSales.map(s => new Date(s.saleDate).getTime())));
        const newestSaleDate = new Date(Math.max(...productSales.map(s => new Date(s.saleDate).getTime())));
        const totalDays = Math.max(30, (newestSaleDate.getTime() - oldestSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        const avgDailySales = totalSoldQuantity / totalDays;
        
        // Consider inventory excessive if it has more than 120 days of supply
        const daysOfSupply = product.stockQuantity / avgDailySales;
        return daysOfSupply > 120 && product.stockQuantity > 10;
      });
      
      excessInventoryItems.forEach(product => {
        const productSales = salesData.filter(sale => sale.productId === product.id);
        const totalSoldQuantity = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
        const totalDays = 30; // Use 30 days as default for simplicity
        const avgDailySales = totalSoldQuantity / totalDays || 0.01; // Avoid divide by zero
        const daysOfSupply = Math.round(product.stockQuantity / avgDailySales);
        
        alerts.push({
          id: uuidv4(),
          type: "inventory",
          message: `${product.name} has excess inventory (${product.stockQuantity} units, ${daysOfSupply} days of supply). Consider promotions or inventory reduction.`,
          product: product,
          timestamp: now,
          priority: 4 // Lower priority
        });
      });
      
      // Sort alerts by priority (lower number = higher priority)
      alerts.sort((a, b) => a.priority - b.priority);
      
      // Format the dashboard data
      const dashboardData = {
        metrics: {
          totalProducts: products.length,
          lowStockItems: lowStockProducts.length,
          outOfStock: outOfStockCount,
          salesValue: salesValue
        },
        lowStockProducts,
        integrations,
        alerts: alerts
      };
      
      return res.json(dashboardData);
      
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  });
  
  // Dismiss an alert
  app.post(`${apiPrefix}/alerts/dismiss`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { alertId, alertType, productId } = req.body;
      
      if (!alertId && !alertType) {
        return res.status(400).json({ 
          message: "Either alertId or alertType is required" 
        });
      }
      
      // In a real implementation, we would update the database
      // For now, we'll just return a success response
      console.log(`Alert dismissed: ${alertId || alertType} for product ${productId}`);
      
      return res.json({
        success: true,
        message: "Alert dismissed successfully" 
      });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  
  // Simple chatbot endpoint
  app.post(`${apiPrefix}/chatbot`, async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // In a real app, this would use OpenAI API
      // For this MVP, we'll use simple pattern matching
      
      let response = "";
      const lowerMessage = message.toLowerCase();
      
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (lowerMessage.includes("restock") || lowerMessage.includes("low stock")) {
        const products = await storage.getLowStockProducts(userId);
        response = `Here are the items needing attention:\n`;
        products.forEach(product => {
          response += `- ${product.name}: ${product.stockQuantity} left\n`;
        });
        response += "\nWould you like me to recommend optimal order quantities based on your forecasted demand?";
      } 
      else if (lowerMessage.includes("best sell") || lowerMessage.includes("top product")) {
        response = "Your best selling products this month are:\n1. Premium Water Bottle (+18% MoM)\n2. Wireless Headphones (+12% MoM)\n3. Smart Home Hub (+8% MoM)\n\nWould you like to see detailed performance metrics?";
      } 
      else if (lowerMessage.includes("forecast") || lowerMessage.includes("predict") || lowerMessage.includes("next month")) {
        response = "Based on historical data and current trends, I forecast a 15% increase in overall sales next month. Your Apparel category is expected to grow by 22% due to seasonal factors. Would you like to adjust inventory levels accordingly?";
      }
      else if (lowerMessage.includes("recommend") || lowerMessage.includes("order") || lowerMessage.includes("quantit")) {
        const lowStockProducts = await storage.getLowStockProducts(userId);
        
        response = "Based on your sales trends and forecasts, here are my recommended order quantities:\n";
        
        for (const product of lowStockProducts) {
          // Get sales history
          const sales = await storage.getSalesByProduct(product.id);
          
          // Simple forecast
          const forecastQuantity = generateForecast(sales);
          
          // Add some buffer (20%)
          const recommendedQuantity = Math.max(
            (product.lowStockThreshold || 10) * 2, // Default to 10 if null
            Math.ceil(forecastQuantity * 1.2)
          );
          
          response += `- ${product.name}: ${recommendedQuantity} units (${Math.round(forecastQuantity / 30 * 30)}-day supply)\n`;
        }
        
        response += "\nWould you like me to prepare these orders for you?";
      }
      else {
        response = "I'm here to help with your inventory management. You can ask me about:\n- Which products need restocking\n- Your best selling products\n- Sales forecasts for next month\n- Recommended order quantities";
      }
      
      return res.json({ response });
      
    } catch (err) {
      console.error("Chatbot error:", err);
      return res.status(500).json({ message: "Failed to process chatbot request" });
    }
  });

  // Add Shopify auth routes
  app.post(`${apiPrefix}/integrations/shopify/auth`, async (req, res) => {
    try {
      const { storeUrl, state } = req.body;
      
      if (!storeUrl) {
        return res.status(400).json({ message: 'Store URL is required' });
      }
      
      // Normalize the store URL
      let cleanStoreUrl = storeUrl.trim().toLowerCase();
      if (!cleanStoreUrl.startsWith('http')) {
        cleanStoreUrl = `https://${cleanStoreUrl}`;
      }
      if (cleanStoreUrl.endsWith('/')) {
        cleanStoreUrl = cleanStoreUrl.slice(0, -1);
      }
      
      // Validate the store URL
      const isValid = await validateShopifyStore(cleanStoreUrl);
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid Shopify store URL' });
      }
      
      // Generate the authorization URL
      const params = {
        client_id: SHOPIFY_CLIENT_ID,
        scope: SHOPIFY_SCOPES,
        redirect_uri: SHOPIFY_REDIRECT_URI,
        state: state || crypto.randomBytes(16).toString('hex')
      };
      
      const authUrl = `${cleanStoreUrl}/admin/oauth/authorize?${new URLSearchParams(params)}`;
      
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating Shopify auth URL:', error);
      res.status(500).json({ message: 'Failed to generate authorization URL' });
    }
  });
  
  // Add Shopify callback route
  app.get(`${apiPrefix}/auth/callback`, async (req, res) => {
    try {
      const { code, state, shop } = req.query;
      
      if (!code || !state || !shop) {
        return res.redirect('/#/integrations?error=Missing required parameters');
      }
      
      // Exchange the code for an access token
      const tokenData = await exchangeShopifyCodeForToken(code as string, shop as string);
      
      if (!tokenData.access_token) {
        return res.redirect('/#/integrations?error=Failed to obtain access token');
      }
      
      // Save the access token to a file
      saveAccessTokenToFile(tokenData.access_token, shop as string);
      
      // IMPORTANT: Log the token to console for easy access
      console.log('\n==============================================================');
      console.log('✅ SHOPIFY ACCESS TOKEN RECEIVED:');
      console.log(tokenData.access_token);
      console.log('==============================================================\n');
      console.log('To use this token, run:');
      console.log(`node fetch-shopify-data.js "${tokenData.access_token}"`);
      console.log('==============================================================\n');
      
      // Create or update the integration
      const userId = getUserIdFromSession(req, res);
      
      // Check if integration exists
      const existingIntegrations = await storage.getIntegrations(userId);
      const existingIntegration = existingIntegrations.find(i => 
        i.platform === 'shopify' && i.storeUrl === shop
      );
      
      if (existingIntegration) {
        // Update existing integration
        await storage.updateIntegration(existingIntegration.id, {
          accessToken: tokenData.access_token,
          isConnected: true,
          storeUrl: shop as string
        });
      } else {
        // Create new integration
        await storage.createIntegration({
          userId,
          platform: 'shopify',
          storeUrl: shop as string,
          accessToken: tokenData.access_token,
          isConnected: true
        });
      }
      
      // After successfully getting the access token, register webhooks
      const webhooks = [
        {
          topic: 'products/create',
          address: `${process.env.APP_URL}/api/webhooks/shopify/products`,
          format: 'json'
        },
        {
          topic: 'products/update',
          address: `${process.env.APP_URL}/api/webhooks/shopify/products`,
          format: 'json'
        },
        {
          topic: 'products/delete',
          address: `${process.env.APP_URL}/api/webhooks/shopify/products`,
          format: 'json'
        }
      ];

      for (const webhook of webhooks) {
        try {
          await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ webhook })
          });
          console.log(`Registered ${webhook.topic} webhook for shop ${shop}`);
        } catch (webhookError) {
          console.error(`Failed to register ${webhook.topic} webhook:`, webhookError);
        }
      }
      
      // Redirect back to the frontend with success
      res.redirect('/#/integrations?success=true');
    } catch (error: any) {
      console.error('Error in Shopify OAuth callback:', error);
      res.redirect('/integrations?error=auth_failed');
    }
  });
  
  app.post(`${apiPrefix}/integrations/shopify/refresh`, async (req, res) => {
    try {
      const { integrationId } = req.body;
      
      if (!integrationId) {
        return res.status(400).json({ message: "Integration ID is required" });
      }
      
      // Get all integrations for the demo user
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const integrations = await storage.getIntegrations(userId);
      const integration = integrations.find(i => i.id === integrationId);
      
      if (!integration || integration.platform !== 'shopify') {
        return res.status(404).json({ message: "Shopify integration not found" });
      }
      
      // Shopify access tokens don't expire by default, so we'll just return the current integration
      // In a real app with expiring tokens, you would implement token refresh logic here
      
      return res.json(integration);
    } catch (err) {
      console.error('Error refreshing Shopify token:', err);
      return res.status(500).json({ message: "Failed to refresh token" });
    }
  });
  
  app.post(`${apiPrefix}/integrations/shopify/sync`, async (req, res) => {
    try {
      const { integrationId } = req.body;
      
      if (!integrationId) {
        return res.status(400).json({ message: "Integration ID is required" });
      }
      
      // Get all integrations for the demo user
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const integrations = await storage.getIntegrations(userId);
      const integration = integrations.find(i => i.id === integrationId);

      if (!integration || integration.platform !== 'shopify') {
        return res.status(404).json({ message: "Shopify integration not found" });
      }

      if (!integration.accessToken || !integration.storeUrl) {
        return res.status(400).json({ message: "Integration is missing required credentials" });
      }

      // Fetch products from Shopify
      const response = await fetch(`https://${integration.storeUrl}/admin/api/2024-01/products.json`, {
        headers: {
          'X-Shopify-Access-Token': integration.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const data = await response.json() as { products: any[] };
      // Filter out archived products
      const shopifyProducts = (data.products || []).filter(product => product.status !== 'archived');

      // Get all existing Shopify products from our database
      const existingProducts = await storage.getProducts(userId);
      const existingShopifyProducts = existingProducts.filter(p => p.platforms?.includes('shopify'));

      // Track which products we've processed
      const processedProductIds = new Set<string>();

      // Process and store each product
      const syncedProducts = [];
      const errors = [];
      const deletedProducts = [];

      for (const shopifyProduct of shopifyProducts) {
        try {
          const variant = shopifyProduct.variants[0]; // Get first variant for now

          // Create or update product
          const productData = {
            userId,
            name: shopifyProduct.title,
            sku: variant.sku || `SHOPIFY-${shopifyProduct.id}`,
            description: shopifyProduct.body_html || '',
            price: variant.price.toString(),
            stockQuantity: variant.inventory_quantity || 0,
            platforms: ['shopify'],
            platformIds: [shopifyProduct.id.toString()],
            category: shopifyProduct.product_type || 'Default',
            lowStockThreshold: 10,
            reorderPoint: 5,
            brand: shopifyProduct.vendor || null,
            shopifyProductId: shopifyProduct.id.toString(),
            shopifyVariantId: variant.id.toString()
          };

          // Check if product exists
          const existingProduct = await storage.getProductByPlatformId(userId, 'shopify', productData.platformIds[0]);

          let product;
          if (existingProduct) {
            // Update existing product
            product = await storage.updateProduct(existingProduct.id, {
              ...productData,
              stockQuantity: variant.inventory_quantity || existingProduct.stockQuantity,
              lowStockThreshold: existingProduct.lowStockThreshold,
              reorderPoint: existingProduct.reorderPoint
            });
            if (product) {
              console.log(`Updated product: ${product.name} (ID: ${product.id})`);
            }
          } else {
            // Create new product
            product = await storage.createProduct(productData);
            if (product) {
              console.log(`Created new product: ${product.name} (ID: ${product.id})`);
            }
          }

          // Sync vendor as supplier if provided and create product-supplier relationship
          if (shopifyProduct.vendor && product?.id) {
            const supplier = await syncVendorAsSupplier(shopifyProduct.vendor, userId, product.id, variant.price.toString());
            if (supplier && product) {
              console.log(`Synced vendor ${shopifyProduct.vendor} as supplier for product ${product.name}`);
            }
          }

          if (product) {
            syncedProducts.push(product);
            processedProductIds.add(shopifyProduct.id.toString());
          }
        } catch (productError) {
          console.error(`Error syncing product ${shopifyProduct.title}:`, productError);
          errors.push({
            productId: shopifyProduct.id,
            title: shopifyProduct.title,
            error: productError instanceof Error ? productError.message : 'Unknown error'
          });
        }
      }

      // Delete products that no longer exist in Shopify
      for (const existingProduct of existingShopifyProducts) {
        if (existingProduct.platformIds?.[0] && !processedProductIds.has(existingProduct.platformIds[0])) {
          try {
            await storage.deleteProduct(existingProduct.id);
            deletedProducts.push({
              id: existingProduct.id,
              name: existingProduct.name,
              platformId: existingProduct.platformIds[0]
            });
            console.log(`Deleted product ${existingProduct.name} (ID: ${existingProduct.id}) as it no longer exists in Shopify`);
          } catch (deleteError) {
            console.error(`Error deleting product ${existingProduct.name}:`, deleteError);
            errors.push({
              productId: existingProduct.id,
              title: existingProduct.name,
              error: 'Failed to delete product that no longer exists in Shopify' 
            });
          }
        }
      }

      // ===== SYNC SALES DATA FROM SHOPIFY ORDERS =====
      console.log('Syncing sales data from Shopify orders...');
      const syncedSales = [];
      const salesErrors = [];

      try {
        // Fetch orders from Shopify
        const ordersResponse = await fetch(`https://${integration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=50`, {
          headers: {
            'X-Shopify-Access-Token': integration.accessToken,
            'Content-Type': 'application/json'
          }
        });

        if (!ordersResponse.ok) {
          throw new Error(`Failed to fetch orders: ${ordersResponse.statusText}`);
        }

        const ordersData = await ordersResponse.json() as { orders: any[] };
        const shopifyOrders = ordersData.orders || [];

        // Get all existing sales from our database to avoid duplicates
        const existingSales = await storage.getSales(userId);
        const existingSalesByOrderId = existingSales.reduce((acc, sale) => {
          if (sale.externalOrderId) {
            acc[sale.externalOrderId] = true;
          }
          return acc;
        }, {} as { [key: string]: boolean });

        // Process each order
        for (const order of shopifyOrders) {
          // Skip cancelled or unfulfilled orders
          if (order.cancelled_at || order.fulfillment_status !== 'fulfilled') {
            continue;
          }

          // Process each line item in the order
          for (const lineItem of order.line_items) {
            try {
              // Skip if no product ID or variant ID
              if (!lineItem.product_id || !lineItem.variant_id) {
                continue;
              }

              // Look up our product by Shopify product ID
              const product = await storage.getProductByPlatformId(userId, 'shopify', lineItem.product_id.toString());

              if (!product) {
                console.log(`Product not found for Shopify line item: ${lineItem.title} (Product ID: ${lineItem.product_id})`);
                continue;
              }

              // Create a unique order line ID to avoid duplicates
              const orderLineId = `shopify-${order.id}-${lineItem.id}`;

              // Skip if already imported
              if (existingSalesByOrderId[orderLineId]) {
                continue;
              }

              // Create sales record
              const saleData = {
                userId,
                productId: product.id,
                quantity: lineItem.quantity,
                saleDate: new Date(order.processed_at || order.created_at),
                revenue: (parseFloat(lineItem.price) * lineItem.quantity).toString(),
                platform: 'shopify',
                externalOrderId: orderLineId, // Use a unique identifier for this line item
                customerEmail: order.email || null,
                customerName: order.customer?.first_name && order.customer?.last_name 
                  ? `${order.customer.first_name} ${order.customer.last_name}`
                  : null,
                notes: `Order #${order.order_number}`
              };

              const sale = await storage.createSale(saleData);
              if (sale) {
                syncedSales.push(sale);
                console.log(`Created sale record from Shopify order #${order.order_number} for product ${product.name}`);
              }
            } catch (lineItemError) {
              console.error(`Error processing line item in order ${order.id}:`, lineItemError);
              salesErrors.push({
                orderId: order.id,
                lineItemId: lineItem.id,
                error: lineItemError instanceof Error ? lineItemError.message : 'Unknown error'
              });
            }
          }
        }
      } catch (ordersError) {
        console.error('Error fetching or processing Shopify orders:', ordersError);
        salesErrors.push({
          error: ordersError instanceof Error ? ordersError.message : 'Unknown error'
        });
      }

      // Update the last synced timestamp
      const updatedIntegration = await storage.updateIntegration(integrationId, {
        lastSynced: new Date(),
        isConnected: true
      });

      return res.json({
        success: true,
        integration: updatedIntegration,
        stats: {
          total: shopifyProducts.length,
          synced: syncedProducts.length,
          deleted: deletedProducts.length,
          errors: errors.length,
          salesSynced: syncedSales.length,
          salesErrors: salesErrors.length
        },
        deletedProducts: deletedProducts.length > 0 ? deletedProducts : undefined,
        errors: errors.length > 0 ? errors : undefined,
        salesStats: {
          synced: syncedSales.length,
          errors: salesErrors.length
        }
      });
    } catch (error) {
      console.error('Error syncing Shopify data:', error);
      return res.status(500).json({
        message: "Failed to sync data from Shopify",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.get(`${apiPrefix}/integrations/shopify/products`, async (req, res) => {
    try {
      const integrationId = parseInt(req.query.integrationId as string);
      
      if (isNaN(integrationId)) {
        return res.status(400).json({ message: "Valid integration ID is required" });
      }
      
      // Get all integrations for the demo user
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const integrations = await storage.getIntegrations(userId);
      const integration = integrations.find(i => i.id === integrationId);
      
      if (!integration || integration.platform !== 'shopify') {
        return res.status(404).json({ message: "Shopify integration not found" });
      }
      
      if (!integration.accessToken || !integration.storeUrl) {
        return res.status(400).json({ message: "Integration is missing required credentials" });
      }
      
      // Fetch products from Shopify
      const products = await fetchShopifyProducts(integration.storeUrl, integration.accessToken);
      
      return res.json({ products });
    } catch (err) {
      console.error('Error fetching Shopify products:', err);
      return res.status(500).json({ message: "Failed to fetch products from Shopify" });
    }
  });
  
  app.get(`${apiPrefix}/integrations/shopify/orders`, async (req, res) => {
    try {
      const integrationId = parseInt(req.query.integrationId as string);
      
      if (isNaN(integrationId)) {
        return res.status(400).json({ message: "Valid integration ID is required" });
      }
      
      // Get all integrations for the demo user
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const integrations = await storage.getIntegrations(userId);
      const integration = integrations.find(i => i.id === integrationId);
      
      if (!integration || integration.platform !== 'shopify') {
        return res.status(404).json({ message: "Shopify integration not found" });
      }
      
      if (!integration.accessToken || !integration.storeUrl) {
        return res.status(400).json({ message: "Integration is missing required credentials" });
      }
      
      // Fetch orders from Shopify
      const orders = await fetchShopifyOrders(integration.storeUrl, integration.accessToken);
      
      return res.json({ orders });
    } catch (err) {
      console.error('Error fetching Shopify orders:', err);
      return res.status(500).json({ message: "Failed to fetch orders from Shopify" });
    }
  });

  // Add Shopify test endpoint
  app.get(`${apiPrefix}/integrations/shopify/test`, async (req, res) => {
    try {
      // Get all integrations for the demo user
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const integrations = await storage.getIntegrations(userId);
      const integration = integrations.find(i => i.platform === 'shopify' && i.isConnected);
      
      if (!integration || !integration.accessToken || !integration.storeUrl) {
        return res.status(404).json({ message: "No connected Shopify integration found" });
      }

      // Fetch shop information from Shopify
      const response = await fetch(`https://${integration.storeUrl}/admin/api/2024-01/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': integration.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch shop data: ${response.statusText}`);
      }

      const shopData = await response.json();
      return res.json(shopData);
    } catch (error: any) {
      console.error('Error testing Shopify connection:', error);
      return res.status(500).json({ 
        message: "Failed to test Shopify connection",
        error: error?.message
      });
    }
  });

  // Add this API endpoint after the other Shopify integration routes
  app.get(`${apiPrefix}/integrations/shopify/token`, async (req, res) => {
    try {
      const tokenFilePath = path.join(process.cwd(), 'tokens', 'shopify_access_token.json');
      
      if (!fs.existsSync(tokenFilePath)) {
        return res.status(404).json({ 
          message: "No Shopify access token found. Please authenticate first.",
          hint: "Connect your Shopify store through the Integrations page."
        });
      }
      
      const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
      
      // For security, we can add some basic validation to ensure only authorized requests get the token
      // In a production app, you would use proper authentication
      // This is just for development/testing purposes
      const { includeToken } = req.query;
      
      if (includeToken === 'true') {
        return res.json(tokenData);
      } else {
        // Return metadata without the actual token
        return res.json({
          shopUrl: tokenData.shopUrl,
          timestamp: tokenData.timestamp,
          message: "Token is available. Use ?includeToken=true to include the actual token in the response."
        });
      }
    } catch (err) {
      console.error('Error retrieving Shopify token:', err);
      return res.status(500).json({ message: "Failed to retrieve token information" });
    }
  });

  // Add orders endpoint
  app.post(`${apiPrefix}/orders`, async (req, res) => {
    try {
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { productId, quantity, supplier, deliverySpeed, notifyOnShipment } = req.body;
      
      if (!productId || !quantity) {
        return res.status(400).json({ message: "Product ID and quantity are required" });
      }
      
      // Get the product
      const product = await storage.getProductById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Calculate new stock quantity
      const newStockQuantity = product.stockQuantity + quantity;
      
      // Update product stock in local database
      const updatedProduct = await storage.updateProduct(productId, {
        stockQuantity: newStockQuantity
      });
      
      if (!updatedProduct) {
        return res.status(500).json({ message: "Failed to update product stock" });
      }
      
      // If product is from Shopify, sync the stock update
      if (product.platforms?.includes('shopify') && product.platformIds?.length) {
        try {
          // Get the Shopify integration
          const integrations = await storage.getIntegrations(userId);
          const shopifyIntegration = integrations.find(
            i => i.platform === 'shopify' && i.isConnected
          );
          
          if (shopifyIntegration && shopifyIntegration.accessToken && shopifyIntegration.storeUrl) {
            // First, fetch the product from Shopify to get the inventory_item_id
            const shopifyProductUrl = `https://${shopifyIntegration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products/${product.platformIds[0]}.json`;
            
            const productResponse = await fetch(shopifyProductUrl, {
              headers: {
                'X-Shopify-Access-Token': shopifyIntegration.accessToken,
                'Content-Type': 'application/json'
              }
            });
            
            if (productResponse.ok) {
              const productData = await productResponse.json() as { product?: any };
              
              if (
                productData.product &&
                productData.product.variants &&
                productData.product.variants.length > 0
              ) {
                const variant = productData.product.variants[0];
                const inventoryItemId = variant.inventory_item_id;
                
                // Fetch locations to get the location ID
                const locationsResponse = await fetch(
                  `https://${shopifyIntegration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/locations.json`,
                  {
                    headers: {
                      'X-Shopify-Access-Token': shopifyIntegration.accessToken,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                if (locationsResponse.ok) {
                  const locationsData = await locationsResponse.json() as { locations?: any[] };
                  
                  if (locationsData.locations && locationsData.locations.length > 0) {
                    const locationId = locationsData.locations[0].id;
                    
                    // Update inventory level in Shopify
                    const updateResponse = await fetch(
                      `https://${shopifyIntegration.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels/set.json`,
                      {
                        method: 'POST',
                        headers: {
                          'X-Shopify-Access-Token': shopifyIntegration.accessToken,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          inventory_item_id: inventoryItemId,
                          location_id: locationId,
                          available: newStockQuantity
                        })
                      }
                    );
                  }
                }
              }
            }
          }
        } catch (syncError) {
          console.error('Error syncing with Shopify:', syncError);
          // Continue with local update even if Shopify sync fails
        }
      }
      
      // Create an order record
      const order = {
        productId,
        userId,
        quantity,
        supplier,
        deliverySpeed,
        notifyOnShipment,
        orderDate: new Date().toISOString(),
        status: 'pending'
      };
      
      // In a real app, we would store the order in the database
      console.log('Order created:', order);
      
      return res.status(201).json({
        success: true,
        message: "Order placed successfully",
        order,
        updatedProduct
      });
      
    } catch (err) {
      console.error('Error in orders endpoint:', err);
      return handleValidationError(err, res);
    }
  });

  // Update Shopify product prices
  app.put(`${apiPrefix}/integrations/shopify/products/prices`, async (req: Request & { user?: { id: number } }, res) => {
    try {
      const { updates } = req.body;
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get Shopify integration
      const integration = await storage.getIntegrationByPlatform(userId, 'shopify');
      if (!integration || !integration.storeUrl || !integration.accessToken) {
        return res.status(404).json({ 
          success: false,
          message: 'Shopify integration not found or missing required credentials' 
        });
      }

      const { storeUrl, accessToken } = integration;

      // Update each product's price
      const results = await Promise.all(
        updates.map(async ({ productId, newPrice }: { productId: string; newPrice: string }) => {
          try {
            // First get the product to get the variant ID
            const productResponse = await fetch(
              `https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`,
              {
                headers: {
                  'X-Shopify-Access-Token': accessToken,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!productResponse.ok) {
              throw new Error(`Failed to fetch product ${productId}: ${productResponse.statusText}`);
            }

            const productData = (await productResponse.json()) as ShopifyProduct;
            const variantId = productData.product.variants[0].id;

            // Update the variant's price
            const updateResponse = await fetch(
              `https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`,
              {
                method: 'PUT',
                headers: {
                  'X-Shopify-Access-Token': accessToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  variant: {
                    id: variantId,
                    price: newPrice
                  }
                })
              }
            );

            if (!updateResponse.ok) {
              const errorData = await updateResponse.json();
              throw new Error(`Failed to update price for product ${productId}: ${JSON.stringify(errorData)}`);
            }

            return { productId, success: true };
          } catch (error) {
            console.error(`Error updating product ${productId}:`, error);
            return { productId, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        })
      );

      const failedUpdates = results.filter(r => !r.success);
      if (failedUpdates.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Failed to update prices for ${failedUpdates.length} products`,
          failures: failedUpdates
        });
      }

      return res.json({
        success: true,
        message: `Successfully updated prices for ${results.length} products`
      });
    } catch (error) {
      console.error('Error updating Shopify product prices:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred while updating prices'
      });
    }
  });

  app.get('/api/product-suppliers', async (req, res) => {
    try {
      const supplierId = req.query.supplierId ? parseInt(req.query.supplierId as string) : undefined;
      const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;

      if (!supplierId && !productId) {
        return res.status(400).json({ error: 'Either supplierId or productId is required' });
      }

      let productSuppliers: ProductSupplier[] = [];
      if (supplierId) {
        console.log(`Fetching product suppliers for supplier ID: ${supplierId}`);
        productSuppliers = await storage.getProductSuppliersBySupplierId(supplierId);
        console.log(`Found ${productSuppliers.length} product suppliers`);
      } else if (productId) {
        console.log(`Fetching product suppliers for product ID: ${productId}`);
        productSuppliers = await storage.getProductSuppliers(productId);
        console.log(`Found ${productSuppliers.length} product suppliers`);
      }

      // Get product details for each product supplier
      const productsWithDetails = await Promise.all(
        productSuppliers
          .filter(ps => ps.productId !== null)
          .map(async (ps) => {
            const product = await storage.getProductById(ps.productId as number);
            return {
              ...ps,
              product: product ? {
                name: product.name,
                sku: product.sku,
                category: product.category
              } : null
            };
          })
      );

      console.log(`Returning ${productsWithDetails.length} products with details`);
      res.json(productsWithDetails);
    } catch (error) {
      console.error('Error fetching product suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch product suppliers' });
    }
  });

  // Integrate with Shopify
  app.post(`${apiPrefix}/shopify/connect`, async (req, res) => {
    try {
      const { apiKey, apiSecret, storeUrl } = req.body;
      
      // Get userId from session
      const userId = getUserIdFromSession(req, res);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Validate the connection details
      if (!await validateCredentials('shopify', apiKey, apiSecret, storeUrl)) {
        return res.status(400).json({ message: "Invalid Shopify credentials" });
      }
      
      // Validate store URL
      if (!await validateShopifyStore(storeUrl)) {
        return res.status(400).json({ message: "Invalid Shopify store URL" });
      }
      
      // Create or update the integration
      const existingIntegration = await storage.getIntegrationByPlatform(userId, 'shopify');
      
      // Check if integration exists
      if (existingIntegration) {
        // Update existing integration
        await storage.updateIntegration(existingIntegration.id, {
          apiKey,
          apiSecret,
          storeUrl,
          isConnected: true
        });
        
        return res.status(200).json({ 
          message: "Shopify integration updated successfully",
          integrationId: existingIntegration.id
        });
      } else {
        // Create new integration
        const integration = await storage.createIntegration({
          userId,
          platform: 'shopify',
          apiKey,
          apiSecret,
          storeUrl,
          isConnected: true
        });
        
        return res.status(201).json({ 
          message: "Shopify integration created successfully",
          integrationId: integration.id
        });
      }
    } catch (err) {
      console.error('Error connecting to Shopify:', err);
      return res.status(500).json({ message: "Failed to connect to Shopify" });
    }
  });

  // Add Shopify webhook handlers
  app.post(`${apiPrefix}/webhooks/shopify/products`, async (req, res) => {
    try {
      const topic = req.headers['x-shopify-topic'];
      const shopifyDomain = req.headers['x-shopify-shop-domain'] as string;
      
      // Verify webhook authenticity
      const hmac = req.headers['x-shopify-hmac-sha256'];
      if (!hmac || !config.SHOPIFY_API_SECRET) {
        return res.status(401).json({ message: "Missing HMAC header or API secret" });
      }

      const rawBody = JSON.stringify(req.body);
      const hash = crypto
        .createHmac('sha256', config.SHOPIFY_API_SECRET)
        .update(rawBody)
        .digest('base64');

      if (hash !== hmac) {
        return res.status(401).json({ message: "HMAC verification failed" });
      }

      // Get the integration based on the shop domain
      const integration = await storage.getIntegrationByStoreUrl(shopifyDomain);
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      const data = req.body;
      
      switch (topic) {
        case 'products/delete':
          // Delete product from local database
          const existingProduct = await storage.getProductByPlatformId(integration.userId, 'shopify', data.id.toString());
          if (existingProduct) {
            await storage.deleteProduct(existingProduct.id);
            console.log(`Deleted product ${existingProduct.id} after Shopify deletion`);
          }
          break;

        case 'products/update':
        case 'products/create':
          const variant = data.variants[0]; // Get first variant
          const productData = {
            userId: integration.userId,
            name: data.title,
            sku: variant.sku || `SHOPIFY-${data.id}`,
            description: data.body_html || '',
            price: variant.price.toString(),
            stockQuantity: variant.inventory_quantity || 0,
            platforms: ['shopify'],
            platformIds: [data.id.toString()],
            category: data.product_type || 'Default',
            lowStockThreshold: 10,
            reorderPoint: 5,
            brand: data.vendor || null,
            shopifyProductId: data.id.toString(),
            shopifyVariantId: variant.id.toString()
          };

          // Check if product exists
          const product = await storage.getProductByPlatformId(integration.userId, 'shopify', data.id.toString());
          if (product) {
            // Update existing product
            await storage.updateProduct(product.id, {
              ...productData,
              lowStockThreshold: product.lowStockThreshold,
              reorderPoint: product.reorderPoint
            });
            console.log(`Updated product ${product.id} from Shopify webhook`);
          } else if (topic === 'products/create') {
            // Create new product
            const newProduct = await storage.createProduct(productData);
            console.log(`Created new product ${newProduct.id} from Shopify webhook`);
          }
          break;
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing Shopify webhook:', error);
      res.status(500).json({ message: "Error processing webhook" });
    }
  });

  // CJ Dropshipping API Endpoint
  app.get('/api/integrations/cj-dropshipping/products', async (req, res) => {
    try {
      // This would normally fetch data from CJ Dropshipping API
      // For now we'll return static mock data for the frontend
      const mockProducts = [
        {
          id: '1',
          name: 'Minimalist Wooden Watch',
          description: 'Handcrafted wooden watch with premium quartz movement and genuine leather strap. Perfect for eco-conscious fashion lovers.',
          price: 39.99,
          image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=1000',
          supplier: 'CJ Dropshipping',
          category: 'Accessories',
          popularity: 95,
          rating: 4.7,
          reviewCount: 128,
          tags: ['eco-friendly', 'handmade', 'watches']
        },
        {
          id: '2',
          name: 'Portable Bluetooth Speaker',
          description: 'Waterproof Bluetooth speaker with 24-hour battery life and superior sound quality. Perfect for outdoor adventures.',
          price: 49.99,
          image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=1000',
          supplier: 'CJ Dropshipping',
          category: 'Electronics',
          popularity: 92,
          rating: 4.5,
          reviewCount: 214,
          tags: ['bluetooth', 'waterproof', 'speakers']
        },
        // Additional products would be returned here
      ];
      
      res.json(mockProducts);
    } catch (error) {
      console.error('Error fetching CJ Dropshipping products:', error);
      res.status(500).json({ error: 'Failed to fetch CJ Dropshipping products' });
    }
  });

  // Dropshipping API Endpoint
  app.get('/api/dropshipping/products', async (req, res) => {
    try {
      // This would normally fetch data from various dropshipping suppliers
      const mockProducts = [
        {
          id: '1',
          name: 'Minimalist Wooden Watch',
          description: 'Handcrafted wooden watch with premium quartz movement and genuine leather strap.',
          price: 39.99,
          image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=1000',
          supplier: 'CJ Dropshipping',
          category: 'Accessories',
          popularity: 95,
          rating: 4.7,
          reviewCount: 128,
          tags: ['eco-friendly', 'handmade', 'watches']
        },
        {
          id: '2',
          name: 'Portable Bluetooth Speaker',
          description: 'Waterproof Bluetooth speaker with 24-hour battery life and superior sound quality.',
          price: 49.99,
          image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=1000',
          supplier: 'CJ Dropshipping',
          category: 'Electronics',
          popularity: 92,
          rating: 4.5,
          reviewCount: 214,
          tags: ['bluetooth', 'waterproof', 'speakers']
        },
        {
          id: '3',
          name: 'Ceramic Plant Pot Set',
          description: 'Set of 3 modern ceramic plant pots with bamboo trays for succulents and small plants.',
          price: 29.99,
          image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=1000',
          supplier: 'CJ Dropshipping',
          category: 'Home & Garden',
          popularity: 88,
          rating: 4.8,
          reviewCount: 96,
          tags: ['home decor', 'plants', 'ceramic']
        },
        {
          id: '4',
          name: 'Smart LED Light Strip',
          description: 'WiFi-enabled RGB LED strip light with app control, music sync, and voice compatibility.',
          price: 24.99,
          image: 'https://images.unsplash.com/photo-1608512532726-3e1a3bdd5985?q=80&w=1000',
          supplier: 'CJ Dropshipping',
          category: 'Electronics',
          popularity: 90,
          rating: 4.3,
          reviewCount: 175,
          tags: ['smart home', 'lighting', 'led']
        }
      ];
      
      res.json(mockProducts);
    } catch (error) {
      console.error('Error fetching dropshipping products:', error);
      res.status(500).json({ error: 'Failed to fetch dropshipping products' });
    }
  });

  // CJ Dropshipping Integration
  app.post(`${apiPrefix}/integrations/cj-dropshipping`, async (req, res) => {
    try {
      // Log the request
      console.log('CJ Dropshipping integration request:', {
        body: req.body,
        session: req.session
      });
      
      // Authentication check
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { apiKey, email } = req.body;
      
      // Basic validation
      if (!apiKey || !email) {
        return res.status(400).json({ 
          message: "Missing required credentials: CJ-Access-Token and email are required"
        });
      }
      
      // Get user
      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if integration already exists
      const existingIntegration = await storage.getIntegrationByPlatform(req.session.userId, 'cj-dropshipping');
      
      let integrationData;
      if (existingIntegration) {
        // Update existing integration
        integrationData = {
          ...existingIntegration,
          accessToken: apiKey,
          apiKey: apiKey,
          email: email,
          isConnected: true,
          lastSynced: new Date()
        };
        
        await storage.updateIntegration(existingIntegration.id, integrationData);
        console.log('Updated CJ Dropshipping integration:', integrationData);
      } else {
        // Create new integration
        integrationData = {
          userId: req.session.userId,
          platform: 'cj-dropshipping',
          accessToken: apiKey,
          apiKey: apiKey,
          email: email,
          isConnected: true,
          lastSynced: new Date()
        };
        
        await storage.createIntegration(integrationData);
        console.log('Created new CJ Dropshipping integration:', integrationData);
      }
      
      return res.status(200).json({
        success: true,
        message: "CJ Dropshipping integration saved successfully",
        integration: {
          platform: 'cj-dropshipping',
          isConnected: true,
          lastSynced: new Date()
        }
      });
      
    } catch (err) {
      console.error('CJ Dropshipping integration error:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get products from CJ Dropshipping API
  app.get(`${apiPrefix}/integrations/cj-dropshipping/products`, async (req, res) => {
    try {
      console.log('CJ Dropshipping products request:', {
        query: req.query,
        session: req.session
      });
      
      // Get token from query parameter or from user's saved integration
      const tokenFromQuery = req.query.token as string || undefined;
      
      // Authentication check if no token provided in query
      if (!tokenFromQuery && (!req.session || !req.session.userId)) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get integration from database if no token in query
      let accessToken = tokenFromQuery;
      if (!accessToken) {
        const integration = await storage.getIntegrationByPlatform(req.session.userId, 'cj-dropshipping');
        if (!integration || !integration.apiKey) {
          return res.status(400).json({ 
            message: "CJ Dropshipping integration not configured. Please connect your account first."
          });
        }
        accessToken = integration.apiKey;
      }
      
      console.log('Using CJ-Access-Token:', accessToken ? `${accessToken.substring(0, 5)}...` : 'none');
      
      try {
        // Call the CJ Dropshipping API
        const response = await fetch('https://developers.cjdropshipping.com/api2.0/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CJ-Access-Token': accessToken
          },
          body: JSON.stringify({
            "method": "product/list/get",
            "pageNum": 1,
            "pageSize": 20
          })
        });

        // Log the raw response for debugging
        const responseText = await response.text();
        console.log('CJ API raw response:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing CJ API response:', parseError);
          return res.status(500).json({ 
            message: "Invalid response from CJ API",
            error: parseError.message
          });
        }

        console.log('CJ API response:', data);
        
        if (!data || data.error !== 0) {
          console.error('CJ API error:', data);
          return res.status(400).json({ 
            message: `CJ Dropshipping API error: ${data?.message || 'Unknown error'}`,
            error: data
          });
        }
        
        if (!data.data || !data.data.list) {
          return res.json({ products: [] });
        }
        
        // Transform CJ products to our format
        const products = data.data.list.map(item => ({
          id: item.pid,
          name: item.productNameEn || item.productName,
          description: item.description || '',
          price: item.sellPrice,
          image: item.productImage,
          supplier: 'CJ Dropshipping',
          category: item.categoryName || 'Uncategorized',
          popularity: 90,
          rating: 4.5,
          reviewCount: 100,
          tags: item.tags ? item.tags.split(',') : []
        }));
        
        return res.json({ products });
      } catch (apiError) {
        console.error('Error calling CJ API:', apiError);
        
        // Fall back to mock data if API call fails
        const mockProducts = [
          {
            id: 'cj-001',
            name: 'Minimalist Wooden Watch',
            description: 'Handcrafted wooden watch with premium quartz movement and genuine leather strap. Perfect for eco-conscious fashion lovers.',
            price: 39.99,
            image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=1000',
            supplier: 'CJ Dropshipping',
            category: 'Accessories',
            popularity: 90,
            rating: 4.6,
            reviewCount: 156,
            supplierUrl: 'https://cjdropshipping.com/product/d_1001',
            tags: ['leather', 'watch', 'eco-friendly']
          },
          {
            id: 'cj-002',
            name: 'Portable Bluetooth Speaker',
            description: 'Waterproof Bluetooth speaker with 24-hour battery life and superior sound quality. Perfect for outdoor adventures.',
            price: 45.99,
            image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=1000',
            supplier: 'CJ Dropshipping',
            category: 'Electronics',
            popularity: 94,
            rating: 4.3,
            reviewCount: 203,
            supplierUrl: 'https://cjdropshipping.com/product/d_1002',
            tags: ['bluetooth', 'speaker', 'waterproof']
          },
          {
            id: 'cj-003',
            name: 'Ceramic Plant Pot Set',
            description: 'Set of 3 modern ceramic plant pots with bamboo trays. Ideal for succulents and small indoor plants.',
            price: 29.99,
            image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=1000',
            supplier: 'CJ Dropshipping',
            category: 'Home & Garden',
            popularity: 88,
            rating: 4.8,
            reviewCount: 96,
            supplierUrl: 'https://cjdropshipping.com/product/d_1003',
            tags: ['home decor', 'plants', 'ceramic']
          },
          {
            id: 'cj-004',
            name: 'Smart LED Light Strip',
            description: 'WiFi-enabled RGB LED strip light with app control, music sync, and voice assistant compatibility.',
            price: 24.99,
            image: 'https://images.unsplash.com/photo-1608512532726-3e1a3bdd5985?q=80&w=1000',
            supplier: 'CJ Dropshipping',
            category: 'Electronics',
            popularity: 90,
            rating: 4.3,
            reviewCount: 175,
            supplierUrl: 'https://cjdropshipping.com/product/d_1004',
            tags: ['smart home', 'lighting', 'led']
          },
          {
            id: 'cj-005',
            name: 'Canvas Weekender Bag',
            description: 'Durable canvas weekender bag with genuine leather trim and compartments for organized travel.',
            price: 59.99,
            image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1000',
            supplier: 'CJ Dropshipping',
            category: 'Accessories',
            popularity: 87,
            rating: 4.6,
            reviewCount: 122,
            supplierUrl: 'https://cjdropshipping.com/product/d_1005',
            tags: ['travel', 'bag', 'canvas']
          },
          {
            id: 'cj-006',
            name: 'Stainless Steel Water Bottle',
            description: 'Triple-insulated stainless steel water bottle that keeps drinks cold for 24 hours or hot for 12 hours.',
            price: 19.99,
            image: 'https://images.unsplash.com/photo-1575377527928-6a7995e3b4f8?q=80&w=1000',
            supplier: 'CJ Dropshipping',
            category: 'Accessories',
            popularity: 94,
            rating: 4.9,
            reviewCount: 243,
            supplierUrl: 'https://cjdropshipping.com/product/d_1006',
            tags: ['eco-friendly', 'travel', 'hydration']
          }
        ];
        
        return res.json({ 
          products: mockProducts,
          notice: "Using mock data - CJ API call failed. Check server logs for details."
        });
      }
      
    } catch (err) {
      console.error('Error fetching CJ Dropshipping products:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
