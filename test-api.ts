import axios from 'axios';
import * as dotenv from 'dotenv';
import type { User, Product, Supplier } from '../shared/schema';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

async function testAPI() {
  try {
    console.log('Testing API endpoints...\n');

    // Test creating a user
    console.log('Creating test user...');
    const userResponse = await axios.post<User>(`${API_URL}/users`, {
      username: 'testapi2',
      password: 'testpass',
      fullName: 'Test API User 2',
      email: 'testapi2@example.com',
      plan: 'free'
    });
    console.log('User created:', userResponse.data);
    const userId = userResponse.data.id;

    // Test creating a product
    console.log('\nCreating test product...');
    const productResponse = await axios.post<Product>(`${API_URL}/products`, {
      name: 'API Test Product',
      sku: 'API002',
      category: 'Test',
      description: 'A test product created via API',
      price: '29.99',
      stockQuantity: 50,
      lowStockThreshold: 10,
      reorderPoint: 5,
      platforms: ['test'],
      platformIds: ['test1'],
      userId
    });
    console.log('Product created:', productResponse.data);
    const productId = productResponse.data.id;

    // Test creating a supplier
    console.log('\nCreating test supplier...');
    const supplierResponse = await axios.post<Supplier>(`${API_URL}/suppliers`, {
      name: 'API Test Supplier',
      contactInfo: 'testapi@supplier.com',
      performance: 90,
      leadTime: 3,
      userId
    });
    console.log('Supplier created:', supplierResponse.data);
    const supplierId = supplierResponse.data.id;

    // Test getting all resources
    console.log('\nFetching all resources...');
    const users = await axios.get<User[]>(`${API_URL}/users`);
    console.log('Users:', users.data);

    const products = await axios.get<Product[]>(`${API_URL}/products`);
    console.log('Products:', products.data);

    const suppliers = await axios.get<Supplier[]>(`${API_URL}/suppliers`);
    console.log('Suppliers:', suppliers.data);

    // Test getting single resources
    console.log('\nFetching single resources...');
    const user = await axios.get<User>(`${API_URL}/users/${userId}`);
    console.log('Single user:', user.data);

    const product = await axios.get<Product>(`${API_URL}/products/${productId}`);
    console.log('Single product:', product.data);

    const supplier = await axios.get<Supplier>(`${API_URL}/suppliers/${supplierId}`);
    console.log('Single supplier:', supplier.data);

    // Test updating resources
    console.log('\nUpdating resources...');
    const updatedProduct = await axios.put<Product>(`${API_URL}/products/${productId}`, {
      stockQuantity: 75,
      price: '34.99'
    });
    console.log('Updated product:', updatedProduct.data);

    const updatedSupplier = await axios.put<Supplier>(`${API_URL}/suppliers/${supplierId}`, {
      performance: 95,
      leadTime: 2
    });
    console.log('Updated supplier:', updatedSupplier.data);

    // Clean up
    console.log('\nCleaning up test data...');
    await axios.delete(`${API_URL}/products/${productId}`);
    await axios.delete(`${API_URL}/suppliers/${supplierId}`);
    await axios.delete(`${API_URL}/users/${userId}`);
    console.log('Test data cleaned up successfully');

    console.log('\nAll API tests completed successfully!');
  } catch (error: unknown) {
    const axiosError = error as any;
    if (axiosError.isAxiosError) {
      const responseData = axiosError.response?.data;
      console.error('API test failed:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: responseData
      });
    } else if (error instanceof Error) {
      console.error('API test failed:', error.message);
    } else {
      console.error('API test failed:', String(error));
    }
    process.exit(1);
  }
}

testAPI().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 