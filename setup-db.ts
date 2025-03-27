import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function setupDatabase() {
  // Connect to PostgreSQL with default database
  const pool = new Pool({
    user: 'postgres',
    password: 'leecyaqu110205',
    host: 'localhost',
    port: 5432,
    database: 'postgres' // Connect to default database first
  });

  try {
    // Check if our database exists
    const result = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ['smart_inventory']
    );

    // Create database if it doesn't exist
    if (result.rowCount === 0) {
      console.log('Creating database smart_inventory...');
      await pool.query('CREATE DATABASE smart_inventory');
      console.log('Database created successfully');
    } else {
      console.log('Database smart_inventory already exists');
    }
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase(); 