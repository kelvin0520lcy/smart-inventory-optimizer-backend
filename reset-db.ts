import 'dotenv/config';
import postgres from 'postgres';

async function resetDatabase() {
  console.log('Resetting database (dropping all tables)...');
  
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:leecyaqu110205@localhost:5432/smart_inventory';
  const sql = postgres(connectionString, { max: 1 });
  
  try {
    // Drop tables one by one to respect foreign key constraints
    await sql`DROP TABLE IF EXISTS forecasts CASCADE`;
    console.log('Dropped forecasts table');
    
    await sql`DROP TABLE IF EXISTS sales CASCADE`;
    console.log('Dropped sales table');
    
    await sql`DROP TABLE IF EXISTS product_suppliers CASCADE`;
    console.log('Dropped product_suppliers table');
    
    await sql`DROP TABLE IF EXISTS products CASCADE`;
    console.log('Dropped products table');
    
    await sql`DROP TABLE IF EXISTS suppliers CASCADE`;
    console.log('Dropped suppliers table');
    
    await sql`DROP TABLE IF EXISTS integrations CASCADE`;
    console.log('Dropped integrations table');
    
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    console.log('Dropped users table');
    
    console.log('All tables dropped successfully!');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

resetDatabase().catch((err) => {
  console.error('Failed to reset database:', err);
  process.exit(1);
}); 