import { Router } from 'express';
import userRoutes from './users';
import productRoutes from './products';
import supplierRoutes from './suppliers';

const router = Router();

router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/suppliers', supplierRoutes);

export default router; 