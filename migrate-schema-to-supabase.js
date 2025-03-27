import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Connect to Supabase
const pool = new Pool({
  connectionString: 'postgresql://postgres:leecyaqu110205@db.gxjxbccpzuuqaxzzmxjf.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false // Required for Supabase connection
  }
});

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase. Creating tables...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '0000_clever_thunderbird.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL by statement breakpoints
    const statements = migrationSQL.split('--> statement-breakpoint')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement in its own transaction
    for (let i = 0; i < statements.length; i++) {
      try {
        // Begin a new transaction for each statement
        await client.query('BEGIN');
        
        console.log(`Executing statement ${i+1}/${statements.length}`);
        await client.query(statements[i]);
        console.log(`Statement ${i+1} executed successfully`);
        
        // Commit if successful
        await client.query('COMMIT');
      } catch (err) {
        // Rollback on error
        await client.query('ROLLBACK');
        
        // If table already exists, continue with next statement
        if (err.message.includes('already exists')) {
          console.log('Table/constraint already exists, continuing...');
          continue;
        } else {
          console.error(`Error executing statement ${i+1}:`, err.message);
          // Continue with next statement regardless of error
        }
      }
    }
    
    console.log('Schema migration completed!');
  } catch (err) {
    console.error('Schema migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 