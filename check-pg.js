import pg from 'pg';
const { Client } = pg;

// PostgreSQL connection
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'leecyaqu110205',
  database: 'smart_inventory'
});

async function checkDatabase() {
  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Get list of all tables
    const tablesResult = await client.query(`
      SELECT 
        n.nspname as schema,
        c.relname as table_name 
      FROM pg_catalog.pg_class c
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema, table_name
    `);
    
    console.log('\n=== TABLES IN DATABASE ===');
    for (const row of tablesResult.rows) {
      console.log(`- ${row.schema}.${row.table_name}`);
    }

    // Try to count records in each table
    for (const row of tablesResult.rows) {
      try {
        const fullTableName = `${row.schema}.${row.table_name}`;
        const countResult = await client.query(`SELECT COUNT(*) FROM ${fullTableName}`);
        console.log(`  ${fullTableName}: ${countResult.rows[0].count} records`);
      } catch (err) {
        console.log(`  Error counting records in ${row.schema}.${row.table_name}: ${err.message}`);
      }
    }

    // Sample users data
    const users = await client.query('SELECT id, username, email, full_name, plan FROM users LIMIT 5');
    console.log('\n=== USERS SAMPLE ===');
    users.rows.forEach(user => console.log(user));

    // Sample products data
    const products = await client.query('SELECT id, name, sku, price, stock_quantity FROM products LIMIT 5');
    console.log('\n=== PRODUCTS SAMPLE ===');
    products.rows.forEach(product => console.log(product));

    // Sample sales data
    const sales = await client.query('SELECT id, product_id, quantity, sale_date, revenue FROM sales LIMIT 5');
    console.log('\n=== SALES SAMPLE ===');
    sales.rows.forEach(sale => console.log(sale));

    console.log('\nDatabase check completed successfully');
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    // Close the connection
    await client.end();
    console.log('Database connection closed');
  }
}

// Run the check
checkDatabase(); 