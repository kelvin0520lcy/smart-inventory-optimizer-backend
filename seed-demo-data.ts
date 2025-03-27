import { db } from './db';
import { sales, forecasts, products, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function seedDemoData() {
  try {
    // Get the demo user
    const demoUser = await db.query.users.findFirst({
      where: eq(users.username, 'demo')
    });

    if (!demoUser) {
      console.error('Demo user not found');
      process.exit(1);
    }

    // Get all products for the demo user
    const demoProducts = await db.query.products.findMany({
      where: eq(products.userId, demoUser.id)
    });

    if (demoProducts.length === 0) {
      console.error('No products found for demo user');
      process.exit(1);
    }

    // Generate sales data for the last 30 days
    const salesData = [];
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let date = thirtyDaysAgo; date <= today; date.setDate(date.getDate() + 1)) {
      // Generate 2-5 sales per day
      const numSales = Math.floor(Math.random() * 4) + 2;
      
      for (let i = 0; i < numSales; i++) {
        const product = demoProducts[Math.floor(Math.random() * demoProducts.length)];
        const quantity = Math.floor(Math.random() * 10) + 1;
        const price = parseFloat(product.price);
        const revenue = (quantity * price).toFixed(2);

        salesData.push({
          productId: product.id,
          userId: demoUser.id,
          quantity,
          saleDate: new Date(date),
          revenue,
          platform: Math.random() > 0.5 ? 'shopify' : 'local'
        });
      }
    }

    // Insert sales data
    const createdSales = await db.insert(sales).values(salesData).returning();
    console.log(`Created ${createdSales.length} sales records`);

    // Generate forecast data based on recent sales
    const forecastData = [];
    const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const product of demoProducts) {
      // Calculate average daily sales for this product
      const productSales = createdSales.filter(s => s.productId === product.id);
      const totalSales = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
      const avgDailySales = totalSales / 30;

      // Generate forecasts for next 30 days
      for (let date = new Date(today); date <= next30Days; date.setDate(date.getDate() + 1)) {
        // Add some variation to the forecast
        const variation = 0.8 + Math.random() * 0.4; // 80% to 120% of average
        const forecastQuantity = Math.round(avgDailySales * variation);
        
        forecastData.push({
          productId: product.id,
          userId: demoUser.id,
          forecastDate: new Date(date),
          forecastQuantity,
          confidence: Math.random() > 0.5 ? 'high' : 'medium'
        });
      }
    }

    // Insert forecast data
    const createdForecasts = await db.insert(forecasts).values(forecastData).returning();
    console.log(`Created ${createdForecasts.length} forecast records`);

    console.log('Demo data seeding completed successfully');
  } catch (error) {
    console.error('Error seeding demo data:', error);
    process.exit(1);
  }
}

seedDemoData(); 