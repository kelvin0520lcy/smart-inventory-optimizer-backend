// Script to test both development and production database connections
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to test a database connection
async function testDatabaseConnection(connectionOptions, name) {
  const { Pool } = pg;
  const pool = new Pool(connectionOptions);
  
  console.log(`\n--- Testing ${name} Connection ---`);
  
  try {
    const client = await pool.connect();
    console.log(`✓ Connected to ${name}`);
    
    // Test basic query
    const result = await client.query('SELECT version()');
    console.log(`✓ Successfully executed query`);
    console.log(`Database version: ${result.rows[0].version}`);
    
    // Test table counts
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\nFound ${tables.length} tables:`);
    tables.forEach(t => console.log(`- ${t.table_name}`));
    
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error(`✗ Error connecting to ${name}:`, error.message);
    await pool.end();
    return false;
  }
}

// Main function
async function testConnections() {
  // Load development environment variables
  const devEnvPath = path.join(__dirname, '.env');
  if (fs.existsSync(devEnvPath)) {
    dotenv.config({ path: devEnvPath });
    console.log("Loaded development environment variables");
  }
  
  // Development connection (local PostgreSQL)
  const devConnection = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'leecyaqu110205',
    database: process.env.DB_NAME || 'smart_inventory'
  };
  
  // Test development connection
  const devSuccess = await testDatabaseConnection(devConnection, 'DEVELOPMENT Database');
  
  // Load production environment variables
  const prodEnvPath = path.join(__dirname, '.env.production');
  if (fs.existsSync(prodEnvPath)) {
    dotenv.config({ path: prodEnvPath });
    console.log("\nLoaded production environment variables");
  }
  
  // Production connection (Supabase)
  const prodConnection = {
    connectionString: 'postgresql://postgres:leecyaqu110205@db.gxjxbccpzuuqaxzzmxjf.supabase.co:5432/postgres',
    ssl: {
      rejectUnauthorized: false
    }
  };
  
  // Test production connection
  const prodSuccess = await testDatabaseConnection(prodConnection, 'PRODUCTION Database (Supabase)');
  
  // Summary
  console.log("\n--- Connection Test Summary ---");
  console.log(`Development Connection: ${devSuccess ? '✓ SUCCESS' : '✗ FAILED'}`);
  console.log(`Production Connection:  ${prodSuccess ? '✓ SUCCESS' : '✗ FAILED'}`);
  
  if (!devSuccess || !prodSuccess) {
    process.exit(1);
  }
}

testConnections().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
}); 