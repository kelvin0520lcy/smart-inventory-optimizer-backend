// This script sets up all necessary database configuration for Supabase deployment
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

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
  useSSL: true
};

// Function to create or update a file with proper backup
function updateFile(filePath, content, backup = true) {
  try {
    // Create backup if file exists and backup is enabled
    if (fs.existsSync(filePath) && backup) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      console.log(`Created backup of ${filePath} at ${backupPath}`);
    }
    
    // Write new content
    fs.writeFileSync(filePath, content);
    console.log(`Updated file: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error updating file ${filePath}:`, error);
    return false;
  }
}

// Create or update .env.production
function setupEnvProduction() {
  const envPath = path.join(__dirname, '.env.production');
  
  // Get existing content if available
  let existingContent = {};
  try {
    if (fs.existsSync(envPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      existingContent = envConfig;
    }
  } catch (error) {
    console.error('Error reading existing .env.production:', error);
  }
  
  // Prepare new content
  const envContent = {
    ...existingContent,
    NODE_ENV: 'production',
    DATABASE_URL: supabaseDetails.connectionString,
    DB_HOST: supabaseDetails.host,
    DB_PORT: supabaseDetails.port,
    DB_USER: supabaseDetails.user,
    DB_PASSWORD: supabaseDetails.password,
    DB_NAME: supabaseDetails.database,
    USE_SSL: supabaseDetails.useSSL ? 'true' : 'false'
  };
  
  // Convert to string
  const content = Object.entries(envContent)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  return updateFile(envPath, content);
}

// Update vercel.json
function setupVercelConfig() {
  const vercelPath = path.join(__dirname, 'vercel.json');
  
  // Get existing content if available
  let vercelConfig = {};
  try {
    if (fs.existsSync(vercelPath)) {
      vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    } else {
      vercelConfig = {
        version: 2,
        builds: [{ src: 'index.ts', use: '@vercel/node' }],
        routes: [
          { src: '/api/(.*)', dest: '/index.ts' },
          { src: '/(.*)', dest: '/index.ts' }
        ]
      };
    }
  } catch (error) {
    console.error('Error reading existing vercel.json:', error);
  }
  
  // Update env section
  vercelConfig.env = {
    ...(vercelConfig.env || {}),
    NODE_ENV: 'production',
    DATABASE_URL: supabaseDetails.connectionString,
    DB_HOST: supabaseDetails.host,
    DB_PORT: String(supabaseDetails.port),
    DB_USER: supabaseDetails.user,
    DB_PASSWORD: supabaseDetails.password,
    DB_NAME: supabaseDetails.database,
    USE_SSL: supabaseDetails.useSSL ? 'true' : 'false'
  };
  
  // Convert to formatted JSON
  const content = JSON.stringify(vercelConfig, null, 2);
  return updateFile(vercelPath, content);
}

// Run the setup
async function runSetup() {
  console.log('Setting up Supabase deployment configuration...');
  
  const envResult = setupEnvProduction();
  const vercelResult = setupVercelConfig();
  
  if (envResult && vercelResult) {
    console.log('\nConfiguration files updated successfully!');
    
    // Attempt to test connections
    try {
      console.log('\nTesting Supabase connection...');
      execSync('node server/test-supabase-connection.js', { stdio: 'inherit' });
      console.log('Supabase connection test successful');
    } catch (error) {
      console.error('Supabase connection test failed');
    }
    
    console.log('\nNext steps:');
    console.log('1. Build your application for production');
    console.log('2. Deploy to Vercel using: vercel --prod');
    console.log('3. Verify your deployment is connected to Supabase');
  } else {
    console.error('\nFailed to update some configuration files. Please check errors above.');
    process.exit(1);
  }
}

// Run the script
runSetup().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 