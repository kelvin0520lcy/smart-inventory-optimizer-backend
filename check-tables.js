import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'leecyaqu110205',
  database: 'smart_inventory'
});

async function checkTables() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database');
    
    // List all tables in the database
    const { rows } = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    
    console.log(`\nFound ${rows.length} tables:`);
    rows.forEach(row => {
      console.log(`- ${row.table_schema}.${row.table_name}`);
    });
    
    // See if our main tables exist
    const mainTables = ['users', 'products', 'sales', 'forecasts', 'integrations'];
    for (const table of mainTables) {
      try {
        const { rowCount } = await client.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        `, [table]);
        console.log(`Table "${table}": ${rowCount > 0 ? 'Exists' : 'Does NOT exist'}`);
      } catch (err) {
        console.log(`Error checking table "${table}": ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Database check error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables().catch(err => {
  console.error('Fatal error:', err);
}); 