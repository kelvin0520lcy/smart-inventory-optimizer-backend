// This script tests the application's database connection
// To test production mode: NODE_ENV=production node server/test-app-connection.js

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment based on NODE_ENV
const isProd = process.env.NODE_ENV === 'production';
const envFile = isProd ? '.env.production' : '.env';
const envPath = path.join(__dirname, envFile);

if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envFile}`);
  dotenv.config({ path: envPath });
} else {
  console.log(`${envFile} not found, using existing environment variables`);
}

// Import and test database module
async function testAppConnection() {
  try {
    // Import the database module
    const { initDb, testConnection } = await import('./db-pg.js');
    
    // Initialize the database
    console.log('Initializing database...');
    await initDb();
    
    // Test connection
    console.log('Testing database connection...');
    const isConnected = await testConnection();
    
    if (isConnected) {
      console.log('✓ Application successfully connected to the database');
      console.log(`Mode: ${isProd ? 'PRODUCTION (Supabase)' : 'DEVELOPMENT (Local)'}`);
    } else {
      console.error('✗ Application failed to connect to the database');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error testing connection:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

testAppConnection(); 