import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { products, insertProductSchema } from '../../shared/schema';

const router = Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const allProducts = await db.query.products.findMany({
      with: {
        user: true,
        productSuppliers: {
          with: {
            supplier: true,
          },
        },
      },
    });
    res.json(allProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Get a single product
router.get('/:id', async (req, res) => {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, parseInt(req.params.id)),
      with: {
        user: true,
        productSuppliers: {
          with: {
            supplier: true,
          },
        },
      },
    });
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
    const productData = insertProductSchema.parse(req.body);
    const [newProduct] = await db.insert(products)
      .values(productData)
      .returning();
    
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product' });
  }
});

// Update a product
router.put('/:id', async (req, res) => {
  try {
    const productData = insertProductSchema.partial().parse(req.body);
    const [updatedProduct] = await db.update(products)
      .set(productData)
      .where(eq(products.id, parseInt(req.params.id)))
      .returning();
      
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// Delete a product
router.delete('/:id', async (req, res) => {
  try {
    const [deletedProduct] = await db.delete(products)
      .where(eq(products.id, parseInt(req.params.id)))
      .returning();
      
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

export default router; 