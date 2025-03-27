import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import schema using dynamic import for ESM compatibility
// Using any type for schema since we don't know its structure yet
let schema: any;

// Get the file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, '..', 'shared', 'schema.js');

// Import schema using dynamic import
async function loadSchema(): Promise<boolean> {
  try {
    // Dynamic import works in ESM
    schema = await import('../shared/schema.js');
    console.log("Schema imported successfully using direct path");
    return true;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Error importing schema via direct path:", errorMessage);
    
    try {
      // Try alternative path
      schema = await import(schemaPath);
      console.log("Schema imported successfully using resolved path");
      return true;
    } catch (err2: unknown) {
      const error2Message = err2 instanceof Error ? err2.message : String(err2);
      console.error("Error importing schema via resolved path:", error2Message);
      throw new Error('Failed to import database schema');
    }
  }
}

// Determine if SSL is required (production environment)
const useSSL = process.env.USE_SSL === 'true';
const isProd = process.env.NODE_ENV === 'production';

// PostgreSQL connection options
const connectionOptions = {
  max: 1,
  ssl: useSSL || isProd ? { rejectUnauthorized: false } : false
};

// Get connection string from environment
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:leecyaqu110205@localhost:5432/smart_inventory';

console.log(`Connecting to database in ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`Using SSL: ${useSSL || isProd ? 'YES' : 'NO'}`);

// Create PostgreSQL client
const client = postgres(connectionString, connectionOptions);

// Initialize schema and export db
let db;

// Initialize function that needs to be called before using the database
export async function initializeDb() {
  await loadSchema();
  db = drizzle(client, { schema });
  return db;
}

// Export the database connection (will be undefined until initialized)
export { db };

// Test database connection
export async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await client`SELECT version()`;
    console.log('Database connection successful!');
    console.log('PostgreSQL version:', result[0]?.version);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
} 