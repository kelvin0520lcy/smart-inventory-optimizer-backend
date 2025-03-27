import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Running migrations...');
  
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:leecyaqu110205@localhost:5432/smart_inventory';
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  
  // This will run migrations on the database, creating tables if they don't exist
  // and applying any tracked changes
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  
  console.log('Migrations completed successfully!');
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
}); 