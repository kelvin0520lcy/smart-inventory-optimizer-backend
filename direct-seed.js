import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'leecyaqu110205',
  database: 'smart_inventory'
});

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Clear existing data
    console.log('Clearing existing data...');
    await client.query('DELETE FROM forecasts');
    await client.query('DELETE FROM sales');
    await client.query('DELETE FROM product_suppliers');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM suppliers');
    await client.query('DELETE FROM integrations');
    await client.query('DELETE FROM users');
    
    // Insert demo user
    console.log('Creating demo user...');
    const userResult = await client.query(`
      INSERT INTO users (username, password, full_name, email, plan)
      VALUES ('demo', 'demo123', 'Demo User', 'demo@example.com', 'pro')
      RETURNING *
    `);
    const userId = userResult.rows[0].id;
    console.log('Created user with ID:', userId);
    
    // Insert suppliers
    console.log('Creating suppliers...');
    const supplier1Result = await client.query(`
      INSERT INTO suppliers (user_id, name, contact_info, performance, lead_time)
      VALUES ($1, 'TechSupply Co', 'contact@techsupply.co', 95, 5)
      RETURNING *
    `, [userId]);
    
    const supplier2Result = await client.query(`
      INSERT INTO suppliers (user_id, name, contact_info, performance, lead_time)
      VALUES ($1, 'EcoGoods Ltd', 'orders@ecogoods.com', 88, 7)
      RETURNING *
    `, [userId]);
    
    const supplier3Result = await client.query(`
      INSERT INTO suppliers (user_id, name, contact_info, performance, lead_time)
      VALUES ($1, 'Premium Distributors', 'sales@premiumdist.com', 92, 3)
      RETURNING *
    `, [userId]);
    
    const supplier1Id = supplier1Result.rows[0].id;
    const supplier2Id = supplier2Result.rows[0].id;
    
    // Insert products
    console.log('Creating products...');
    const product1Result = await client.query(`
      INSERT INTO products (
        user_id, name, description, sku, price, stock_quantity, 
        low_stock_threshold, reorder_point, category
      )
      VALUES (
        $1, 'Wireless Headphones', 'High-quality wireless headphones with noise cancellation',
        'WH-001', '129.99', 3, 10, 5, 'Electronics'
      )
      RETURNING *
    `, [userId]);
    
    const product2Result = await client.query(`
      INSERT INTO products (
        user_id, name, description, sku, price, stock_quantity, 
        low_stock_threshold, reorder_point, category
      )
      VALUES (
        $1, 'Premium Water Bottle', 'Insulated stainless steel water bottle',
        'WB-002', '24.99', 45, 20, 15, 'Accessories'
      )
      RETURNING *
    `, [userId]);
    
    const product3Result = await client.query(`
      INSERT INTO products (
        user_id, name, description, sku, price, stock_quantity, 
        low_stock_threshold, reorder_point, category
      )
      VALUES (
        $1, 'Organic Cotton T-Shirt (M)', 'Medium-sized organic cotton t-shirt',
        'TS-003-M', '29.99', 8, 15, 10, 'Apparel'
      )
      RETURNING *
    `, [userId]);
    
    const product4Result = await client.query(`
      INSERT INTO products (
        user_id, name, description, sku, price, stock_quantity, 
        low_stock_threshold, reorder_point, category
      )
      VALUES (
        $1, 'Smart Home Hub', 'Central hub for smart home automation',
        'SH-004', '199.99', 12, 8, 5, 'Electronics'
      )
      RETURNING *
    `, [userId]);
    
    const product5Result = await client.query(`
      INSERT INTO products (
        user_id, name, description, sku, price, stock_quantity, 
        low_stock_threshold, reorder_point, category
      )
      VALUES (
        $1, 'Stainless Steel Water Bottle', 'Eco-friendly reusable water bottle',
        'WB-005', '19.99', 30, 10, 8, 'Accessories'
      )
      RETURNING *
    `, [userId]);
    
    const product1Id = product1Result.rows[0].id;
    const product2Id = product2Result.rows[0].id;
    const product3Id = product3Result.rows[0].id;
    const product4Id = product4Result.rows[0].id;
    const product5Id = product5Result.rows[0].id;
    
    // Create product-supplier relationships
    console.log('Creating product-supplier relationships...');
    await client.query(`
      INSERT INTO product_suppliers (product_id, supplier_id, price, min_order_quantity)
      VALUES ($1, $2, '89.99', 10)
    `, [product1Id, supplier1Id]);
    
    await client.query(`
      INSERT INTO product_suppliers (product_id, supplier_id, price, min_order_quantity)
      VALUES ($1, $2, '12.99', 50)
    `, [product2Id, supplier2Id]);
    
    // Add product-supplier relationships for the new products
    await client.query(`
      INSERT INTO product_suppliers (product_id, supplier_id, price, min_order_quantity)
      VALUES ($1, $2, '15.99', 25)
    `, [product3Id, supplier2Id]);
    
    await client.query(`
      INSERT INTO product_suppliers (product_id, supplier_id, price, min_order_quantity)
      VALUES ($1, $2, '149.99', 5)
    `, [product4Id, supplier1Id]);

    await client.query(`
      INSERT INTO product_suppliers (product_id, supplier_id, price, min_order_quantity)
      VALUES ($1, $2, '9.99', 40)
    `, [product5Id, supplier2Id]);
    
    // Create sales records
    console.log('Creating sales records...');
    const now = new Date();
    
    // Generate more sales data for each product covering past 30 days
    const generateSalesHistory = async (productId, avgQuantity, price) => {
      // Create 10-15 sales records over the past 30 days with some variance
      const numSales = Math.floor(Math.random() * 6) + 10; // 10-15 sales
      
      for (let i = 0; i < numSales; i++) {
        // Random date in past 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const saleDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        
        // Random quantity with some variance around average
        const variance = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const quantity = Math.max(1, avgQuantity + variance);
        
        // Calculate revenue
        const revenue = (parseFloat(price) * quantity).toFixed(2);
        
        await client.query(`
          INSERT INTO sales (product_id, user_id, quantity, sale_date, revenue)
          VALUES ($1, $2, $3, $4, $5)
        `, [productId, userId, quantity, saleDate, revenue]);
      }
    };
    
    // Generate sales history for each product
    console.log('Generating sales history for Product 1 (Wireless Headphones)...');
    await generateSalesHistory(product1Id, 3, '129.99');
    
    console.log('Generating sales history for Product 2 (Premium Water Bottle)...');
    await generateSalesHistory(product2Id, 8, '24.99');
    
    console.log('Generating sales history for Product 3 (Organic Cotton T-Shirt)...');
    await generateSalesHistory(product3Id, 5, '29.99');
    
    console.log('Generating sales history for Product 4 (Smart Home Hub)...');
    await generateSalesHistory(product4Id, 2, '199.99');
    
    console.log('Generating sales history for Product 5 (Stainless Steel Water Bottle)...');
    await generateSalesHistory(product5Id, 6, '19.99');
    
    // Create forecasts
    console.log('Creating forecasts...');
    await client.query(`
      INSERT INTO forecasts (product_id, user_id, forecast_date, forecast_quantity, confidence)
      VALUES ($1, $2, $3, 45, '0.8')
    `, [product1Id, userId, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)]);
    
    await client.query(`
      INSERT INTO forecasts (product_id, user_id, forecast_date, forecast_quantity, confidence)
      VALUES ($1, $2, $3, 60, '0.8')
    `, [product2Id, userId, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)]);
    
    // Add forecasts for the new products
    await client.query(`
      INSERT INTO forecasts (product_id, user_id, forecast_date, forecast_quantity, confidence)
      VALUES ($1, $2, $3, 30, '0.75')
    `, [product3Id, userId, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)]);
    
    await client.query(`
      INSERT INTO forecasts (product_id, user_id, forecast_date, forecast_quantity, confidence)
      VALUES ($1, $2, $3, 15, '0.85')
    `, [product4Id, userId, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)]);
    
    await client.query(`
      INSERT INTO forecasts (product_id, user_id, forecast_date, forecast_quantity, confidence)
      VALUES ($1, $2, $3, 50, '0.7')
    `, [product5Id, userId, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)]);
    
    // Create Shopify integration
    console.log('Creating Shopify integration...');
    await client.query(`
      INSERT INTO integrations (user_id, platform, is_connected, store_url, access_token, last_synced)
      VALUES ($1, 'shopify', true, 'example-store.myshopify.com', 'YOUR_ACCESS_TOKEN_HERE', $2)
    `, [userId, now]);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 