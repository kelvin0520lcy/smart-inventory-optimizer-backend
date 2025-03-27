/**
 * Prepare for Supabase Deployment
 * 
 * This script prepares the application for deployment to a production
 * environment using Supabase as the database backend.
 * 
 * It performs the following tasks:
 * 1. Compiles the database schema
 * 2. Tests the Supabase connection
 * 3. Updates configuration files (if needed)
 * 4. Provides migration instructions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Supabase connection details
const supabaseDetails = {
  host: 'db.gxjxbccpzuuqaxzzmxjf.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'leecyaqu110205',
  database: 'postgres',
  connectionString: 'postgresql://postgres:leecyaqu110205@db.gxjxbccpzuuqaxzzmxjf.supabase.co:5432/postgres',
  ssl: true
};

// Print banner
console.log('\n===============================================');
console.log('      Smart Inventory Optimizer');
console.log('      Supabase Deployment Preparation');
console.log('===============================================\n');

// Run the preparation steps
async function prepareForSupabase() {
  try {
    // Step 1: Compile schema
    console.log('Step 1: Compiling database schema...');
    try {
      execSync('node server/build-schema.js', { stdio: 'inherit' });
      console.log('✓ Schema compilation completed\n');
    } catch (error) {
      console.error('✗ Schema compilation failed');
      console.error(error.message);
      process.exit(1);
    }
    
    // Step 2: Test Supabase connection
    console.log('Step 2: Testing Supabase connection...');
    try {
      // Set environment variables
      process.env.NODE_ENV = 'production';
      process.env.USE_SSL = 'true';
      
      // Run the test
      execSync('node server/test-supabase.js', { stdio: 'inherit' });
      console.log('✓ Supabase connection test completed\n');
    } catch (error) {
      console.error('✗ Supabase connection test failed');
      console.error(error.message);
      process.exit(1);
    }
    
    // Step 3: Verify configuration files
    console.log('Step 3: Verifying configuration files...');
    verifyConfigFiles();
    console.log('✓ Configuration files check completed\n');
    
    // Step 4: Print migration instructions
    printMigrationInstructions();
    
  } catch (error) {
    console.error('Preparation failed:', error.message);
    process.exit(1);
  }
}

// Check required configuration files
function verifyConfigFiles() {
  // Check if .env.production exists
  const envProdPath = path.join(__dirname, '.env.production');
  if (!fs.existsSync(envProdPath)) {
    console.log('! Creating .env.production file...');
    
    // Create file content
    const envContent = [
      '# Server Configuration',
      'PORT=5000',
      'NODE_ENV=production',
      '',
      '# Database Configuration - Supabase',
      `DATABASE_URL=${supabaseDetails.connectionString}`,
      `DB_HOST=${supabaseDetails.host}`,
      `DB_PORT=${supabaseDetails.port}`,
      `DB_USER=${supabaseDetails.user}`,
      `DB_PASSWORD=${supabaseDetails.password}`,
      `DB_NAME=${supabaseDetails.database}`,
      'USE_SSL=true',
      ''
    ].join('\n');
    
    fs.writeFileSync(envProdPath, envContent);
    console.log('✓ Created .env.production file');
  } else {
    console.log('✓ .env.production file exists');
  }
  
  // Check if vercel.json exists
  const vercelPath = path.join(__dirname, 'vercel.json');
  if (!fs.existsSync(vercelPath)) {
    console.log('! Creating vercel.json file...');
    
    // Create file content
    const vercelContent = {
      version: 2,
      builds: [
        {
          src: "index.ts",
          use: "@vercel/node"
        }
      ],
      routes: [
        {
          src: "/api/(.*)",
          dest: "/index.ts"
        },
        {
          src: "/(.*)",
          dest: "/index.ts"
        }
      ],
      env: {
        NODE_ENV: "production",
        DATABASE_URL: supabaseDetails.connectionString,
        DB_HOST: supabaseDetails.host,
        DB_PORT: String(supabaseDetails.port),
        DB_USER: supabaseDetails.user,
        DB_PASSWORD: supabaseDetails.password,
        DB_NAME: supabaseDetails.database,
        USE_SSL: "true"
      }
    };
    
    fs.writeFileSync(vercelPath, JSON.stringify(vercelContent, null, 2));
    console.log('✓ Created vercel.json file');
  } else {
    console.log('✓ vercel.json file exists');
  }
}

// Print migration instructions
function printMigrationInstructions() {
  console.log('===============================================');
  console.log('           DEPLOYMENT INSTRUCTIONS');
  console.log('===============================================\n');
  
  console.log('To complete the migration to Supabase:');
  console.log('\n1. Deploy the schema to Supabase:');
  console.log('   node server/migrate-schema-to-supabase.js');
  
  console.log('\n2. Migrate data to Supabase:');
  console.log('   node server/migrate-data-to-supabase.js');
  
  console.log('\n3. Verify the migration:');
  console.log('   node server/check-supabase-data.js');
  
  console.log('\n4. Build the application:');
  console.log('   npm run build');
  
  console.log('\n5. Deploy to Vercel:');
  console.log('   vercel --prod');
  
  console.log('\nNote: Make sure all required environment variables');
  console.log('are set in your production environment.');
  
  console.log('\n===============================================');
  console.log('Preparation completed successfully! Your application');
  console.log('is now ready for Supabase deployment.');
  console.log('===============================================\n');
}

// Run the preparation
prepareForSupabase(); 