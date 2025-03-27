import { Router } from 'express';
import DatabaseService from '../services/database';

const router = Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await DatabaseService.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Get a single product
router.get('/:id', async (req, res) => {
  try {
    const product = await DatabaseService.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

// Create a new product
router.post('/', async (req, res) => {
  try {
    const product = await DatabaseService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product' });
  }
});

// Update a product
router.put('/:id', async (req, res) => {
  try {
    const product = await DatabaseService.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// Delete a product
router.delete('/:id', async (req, res) => {
  try {
    await DatabaseService.deleteProduct(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// Update inventory
router.post('/:id/inventory', async (req, res) => {
  try {
    const { quantity, location } = req.body;
    const inventory = await DatabaseService.updateInventory(req.params.id, quantity, location);
    res.json(inventory);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ message: 'Failed to update inventory' });
  }
});

export default router; 