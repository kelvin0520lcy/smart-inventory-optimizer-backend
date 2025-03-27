import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { suppliers, insertSupplierSchema } from '../../shared/schema';

const router = Router();

// Get all suppliers
router.get('/', async (req, res) => {
  try {
    const allSuppliers = await db.query.suppliers.findMany({
      with: {
        user: true,
        productSuppliers: {
          with: {
            product: true,
          },
        },
      },
    });
    res.json(allSuppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ message: 'Failed to fetch suppliers' });
  }
});

// Get a single supplier
router.get('/:id', async (req, res) => {
  try {
    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, parseInt(req.params.id)),
      with: {
        user: true,
        productSuppliers: {
          with: {
            product: true,
          },
        },
      },
    });
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ message: 'Failed to fetch supplier' });
  }
});

// Create a new supplier
router.post('/', async (req, res) => {
  try {
    const supplierData = insertSupplierSchema.parse(req.body);
    const [newSupplier] = await db.insert(suppliers)
      .values(supplierData)
      .returning();
    
    res.status(201).json(newSupplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ message: 'Failed to create supplier' });
  }
});

// Update a supplier
router.put('/:id', async (req, res) => {
  try {
    const supplierData = insertSupplierSchema.partial().parse(req.body);
    const [updatedSupplier] = await db.update(suppliers)
      .set(supplierData)
      .where(eq(suppliers.id, parseInt(req.params.id)))
      .returning();
      
    if (!updatedSupplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    res.json(updatedSupplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ message: 'Failed to update supplier' });
  }
});

// Delete a supplier
router.delete('/:id', async (req, res) => {
  try {
    const [deletedSupplier] = await db.delete(suppliers)
      .where(eq(suppliers.id, parseInt(req.params.id)))
      .returning();
      
    if (!deletedSupplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ message: 'Failed to delete supplier' });
  }
});

export default router; 