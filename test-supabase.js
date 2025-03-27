// Direct test for Supabase connection
import pkg from 'pg';
const { Pool } = pkg;

// Supabase connection details
const connectionString = 'postgresql://postgres:leecyaqu110205@db.gxjxbccpzuuqaxzzmxjf.supabase.co:5432/postgres';
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connection
  }
});

async function testSupabaseConnection() {
  const client = await pool.connect();
  try {
    console.log('Testing Supabase database connection...');
    
    // Test basic query
    const result = await client.query('SELECT version()');
    console.log('Supabase connection successful!');
    console.log('PostgreSQL version:', result.rows[0].version);
    
    // Test table existence
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\nAvailable tables in Supabase:');
    tables.forEach(table => console.log(`- ${table.table_name}`));
    
    // Check row counts in key tables
    console.log('\nRow counts:');
    for (const table of ['users', 'products', 'sales', 'suppliers', 'forecasts']) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`- ${table}: ${rows[0].count} rows`);
      } catch (error) {
        console.error(`- Error counting ${table}: ${error.message}`);
      }
    }
    
    console.log('\nConnection test completed successfully');
  } catch (error) {
    console.error('Database connection test failed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testSupabaseConnection().catch(err => {
  console.error('Fatal error:', err.message);
}); 