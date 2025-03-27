import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'leecyaqu110205',
  database: 'smart_inventory'
});

async function executeMigration() {
  const client = await pool.connect();
  try {
    console.log('Connected to database. Running migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '0000_clever_thunderbird.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL by statement breakpoints
    const statements = migrationSQL.split('--> statement-breakpoint')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Begin a transaction
    await client.query('BEGIN');
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      try {
        console.log(`Executing statement ${i+1}/${statements.length}`);
        await client.query(statements[i]);
      } catch (err) {
        console.error(`Error executing statement ${i+1}:`, err.message);
        throw err;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

executeMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 