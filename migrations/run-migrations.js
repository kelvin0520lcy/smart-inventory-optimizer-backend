import { initDb } from '../db-pg.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    // Initialize database connection
    console.log('Initializing database connection...');
    const db = await initDb();
    console.log('Database connection initialized');

    // Read migration files
    const migrationFiles = fs.readdirSync(__dirname)
      .filter(file => file.endsWith('.sql'))
      .filter(file => !file.startsWith('0000_')) // Skip initial migrations
      .sort();

    console.log('Found migration files:', migrationFiles);

    // Run each migration
    for (const file of migrationFiles) {
      try {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(__dirname, file), 'utf-8');
        await db.execute(sql);
        console.log(`Completed migration: ${file}`);
      } catch (error) {
        // If table already exists, continue to next migration
        if (error.code === '42P07') {
          console.log(`Table already exists, skipping: ${file}`);
          continue;
        }
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations(); 