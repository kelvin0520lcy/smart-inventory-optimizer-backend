import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'leecyaqu110205',
  database: 'smart_inventory'
});

async function checkData() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database');
    
    // Check counts for each table
    const tables = ['users', 'products', 'sales', 'suppliers', 'product_suppliers', 'forecasts', 'integrations'];
    
    console.log('\n=== TABLE RECORD COUNTS ===');
    for (const table of tables) {
      const { rows } = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${rows[0].count} records`);
    }
    
    // Check sales counts by product
    console.log('\n=== SALES BY PRODUCT ===');
    const salesByProduct = await client.query(`
      SELECT p.id, p.name, COUNT(*) as sales_count, SUM(s.quantity) as total_quantity, SUM(s.revenue::numeric) as total_revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      GROUP BY p.id, p.name
      ORDER BY p.id
    `);
    salesByProduct.rows.forEach(row => {
      console.log(`${row.name}: ${row.sales_count} sales, ${row.total_quantity} units, $${parseFloat(row.total_revenue).toFixed(2)} revenue`);
    });
    
    // Sample data from each table
    console.log('\n=== SAMPLE DATA ===');
    
    // Users
    const users = await client.query('SELECT * FROM users LIMIT 1');
    console.log('\nUsers:');
    console.log(users.rows[0]);
    
    // Products
    const products = await client.query('SELECT * FROM products');
    console.log('\nProducts:');
    products.rows.forEach(row => console.log(row));
    
    // Sales
    const sales = await client.query('SELECT * FROM sales LIMIT 2');
    console.log('\nSales:');
    sales.rows.forEach(row => console.log(row));
    
    // Forecasts
    const forecasts = await client.query('SELECT * FROM forecasts LIMIT 2');
    console.log('\nForecasts:');
    forecasts.rows.forEach(row => console.log(row));
    
    // Integrations
    const integrations = await client.query('SELECT * FROM integrations LIMIT 1');
    console.log('\nIntegrations:');
    integrations.rows.forEach(row => console.log(row));
    
    console.log('\nDatabase check completed successfully');
  } catch (err) {
    console.error('Database check error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData().catch(err => {
  console.error('Fatal error:', err);
}); 