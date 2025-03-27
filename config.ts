// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Validate required environment variables with fallbacks
// Allow for different naming conventions (API_KEY vs CLIENT_ID)
const requiredVarsWithFallbacks = [
  { key: 'SHOPIFY_CLIENT_ID', fallback: 'SHOPIFY_API_KEY' },
  { key: 'SHOPIFY_CLIENT_SECRET', fallback: 'SHOPIFY_API_SECRET' },
  'SHOPIFY_REDIRECT_URI',
  'SHOPIFY_API_VERSION',
  'SHOPIFY_SCOPES'
];

// Validate environment variables
for (const varItem of requiredVarsWithFallbacks) {
  if (typeof varItem === 'string') {
    // Simple required variable
    if (!process.env[varItem]) {
      console.error(`Missing required environment variable: ${varItem}`);
      process.exit(1);
    }
  } else {
    // Variable with fallback
    const { key, fallback } = varItem;
    if (!process.env[key] && !process.env[fallback]) {
      console.error(`Missing required environment variable: ${key} or ${fallback}`);
      process.exit(1);
    }
  }
}

// Export configuration
export const config = {
  shopify: {
    clientId: process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY,
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET,
    redirectUri: process.env.SHOPIFY_REDIRECT_URI,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
    scopes: process.env.SHOPIFY_SCOPES
  },
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET
};

// Export individual constants for convenience
export const SHOPIFY_API_VERSION = config.shopify.apiVersion; 