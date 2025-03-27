import pg from 'pg';
const { Pool } = pg;

// Connect to Supabase
const pool = new Pool({
  connectionString: 'postgresql://postgres:leecyaqu110205@db.gxjxbccpzuuqaxzzmxjf.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false // Required for Supabase connection
  }
});

async function checkSupabaseData() {
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase database');
    
    // Check counts for each table
    const tables = ['users', 'products', 'sales', 'suppliers', 'product_suppliers', 'forecasts', 'integrations'];
    
    console.log('\n=== TABLE RECORD COUNTS IN SUPABASE ===');
    for (const table of tables) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`${table}: ${rows[0].count} records`);
      } catch (error) {
        console.error(`Error counting records in ${table}:`, error.message);
      }
    }
    
    // Check sales counts by product
    console.log('\n=== SALES BY PRODUCT IN SUPABASE ===');
    try {
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
    } catch (error) {
      console.error('Error getting sales by product:', error.message);
    }
    
    // Sample data from users table
    console.log('\n=== SAMPLE DATA FROM SUPABASE ===');
    
    // Products
    try {
      const { rows: products } = await client.query('SELECT * FROM products LIMIT 5');
      console.log('\nProducts:');
      products.forEach(row => console.log(`${row.id}: ${row.name} (${row.stock_quantity} in stock)`));
    } catch (error) {
      console.error('Error getting products:', error.message);
    }
    
    // Sales
    try {
      const { rows: sales } = await client.query('SELECT * FROM sales LIMIT 3');
      console.log('\nRecent Sales:');
      sales.forEach(row => console.log(`ID: ${row.id}, Product: ${row.product_id}, Quantity: ${row.quantity}, Revenue: $${row.revenue}`));
    } catch (error) {
      console.error('Error getting sales:', error.message);
    }
    
    console.log('\nDatabase check completed successfully');
  } catch (err) {
    console.error('Database check error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSupabaseData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 