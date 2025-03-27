// ESM database connection for PostgreSQL/Supabase
import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Postgres client
const { Pool } = pg;
let pool = null;
let db = null;

// Initialize the database connection
export async function initDb() {
  const isProd = process.env.NODE_ENV === 'production';
  
  // Load environment variables
  const connectionString = process.env.DATABASE_URL;
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || 5432;
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';
  const dbName = process.env.DB_NAME || 'postgres';
  const useSSL = process.env.USE_SSL === 'true' || isProd;
  
  console.log('Initializing database...');
  console.log('Database mode:', isProd ? 'PRODUCTION' : 'DEVELOPMENT');
  console.log('Using SSL:', useSSL ? 'YES' : 'NO');
  console.log(`Connection: postgres://${dbUser}:****@${dbHost}:${dbPort}/${dbName}`);
  
  try {
    // Create a new database pool
    pool = new Pool({
      connectionString,
      ssl: useSSL ? {
        rejectUnauthorized: false
      } : false,
    });
    
    // Initialize Drizzle ORM with the pool
    console.log('Loading compiled schema from:', path.resolve(process.cwd(), 'compiled/schema.js'));
    
    // Dynamically import the schema
    try {
      const schemaPath = path.join(process.cwd(), 'compiled', 'schema.js');
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at ${schemaPath}`);
      }
      
      // Import the schema module
      const schemaModule = await import(schemaPath);
      const schema = schemaModule.default || schemaModule;
      
      if (!schema) {
        throw new Error('Schema module does not export a default schema');
      }
      
      console.log('Compiled schema loaded successfully');
      
      // Initialize Drizzle ORM with the pool and schema
      db = drizzle(pool, { schema });
      
      console.log('Drizzle ORM initialized successfully');
      
    } catch (schemaError) {
      console.error('Failed to load schema:', schemaError);
      console.log('Falling back to Drizzle without schema');
      
      // Initialize Drizzle without schema as fallback
      db = drizzle(pool);
    }
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error.message);
    return false;
  }
}

// Test the database connection
export async function testConnection() {
  if (!pool) {
    console.error('Database pool not initialized');
    return false;
  }
  
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      const timestamp = result.rows[0].now;
      console.log('Database connection successful. Server time:', timestamp);
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
}

// Export the database instance
export { db }; 