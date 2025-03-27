// ESM database connection for PostgreSQL/Supabase
import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

// Get file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compiledDir = path.join(__dirname, 'compiled');
const compiledSchemaPath = path.join(compiledDir, 'schema.js');

// Environment variables
const useSSL = process.env.USE_SSL === 'true';
const isProd = process.env.NODE_ENV === 'production';

// Get connection string from environment
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:leecyaqu110205@localhost:5432/smart_inventory';

// Display connection info (hiding password)
console.log(`Database mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Using SSL: ${useSSL || isProd ? 'YES' : 'NO'}`);
console.log(`Connection: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString,
  ssl: useSSL || isProd ? {
    rejectUnauthorized: false
  } : false
});

// Database placeholder until initialized
let db;
let schemaModule;

// Initialize function - must be called before using the database
export async function initDb() {
  console.log('Initializing database connection...');
  
  try {
    // Load schema
    if (fs.existsSync(compiledSchemaPath)) {
      const compiledUrl = pathToFileURL(compiledSchemaPath).href;
      console.log(`Loading compiled schema from: ${compiledUrl}`);
      schemaModule = await import(compiledUrl);
      console.log('Compiled schema loaded successfully');
    } else {
      console.log('No schema file found, using minimal schema');
      // Create a minimal schema for basic operations
      schemaModule = {
        users: {},
        products: {},
        sales: {},
        suppliers: {},
        product_suppliers: {},
        forecasts: {},
        integrations: {}
      };
    }
    
    // Initialize drizzle with the schema
    const { drizzle } = await import('drizzle-orm/node-postgres');
    db = drizzle(pool, { schema: schemaModule });
    
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Database initialization error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Test database connection
export async function testConnection() {
  const client = await pool.connect();
  try {
    console.log('Testing database connection...');
    const result = await client.query('SELECT version()');
    console.log('Connection successful!');
    console.log('PostgreSQL version:', result.rows[0].version);
    return true;
  } catch (error) {
    console.error('Connection failed:', error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    client.release();
  }
}

// Export db (will be undefined until initDb is called)
export { db }; 