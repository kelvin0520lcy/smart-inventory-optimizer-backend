import { db, testConnection } from './db';
import { storage } from './storage';

async function testDatabaseOperations() {
  try {
    // Test database connection
    await testConnection();

    // Test creating a user
    const user = await storage.createUser({
      username: 'testuser',
      password: 'testpass123',
    });
    console.log('Created user:', user);

    // Test creating a product
    const product = await storage.createProduct({
      userId: user.id,
      name: 'Test Product',
      sku: 'TEST-001',
      description: 'A test product',
      price: '99.99',
      stockQuantity: 100,
      category: 'Test Category',
      platforms: ['test'],
      platformIds: {},
    });
    console.log('Created product:', product);

    // Test creating a supplier
    const supplier = await storage.createSupplier({
      userId: user.id,
      name: 'Test Supplier',
      contactInfo: JSON.stringify({
        email: 'supplier@test.com',
        phone: '123-456-7890',
        address: '123 Test St',
      }),
      leadTime: 7,
      performance: 95,
    });
    console.log('Created supplier:', supplier);

    // Test creating a product-supplier relationship
    const productSupplier = await storage.createProductSupplier({
      productId: product.id,
      supplierId: supplier.id,
      price: '80.00',
      minOrderQuantity: 10,
    });
    console.log('Created product-supplier relationship:', productSupplier);

    // Clean up test data
    await storage.deleteProductSupplier(productSupplier.id);
    await storage.deleteProduct(product.id);
    await storage.deleteSupplier(supplier.id);
    await storage.deleteUser(user.id);
    console.log('Successfully cleaned up test data');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDatabaseOperations()
  .then(() => {
    console.log('All tests passed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Tests failed:', error);
    process.exit(1);
  }); 