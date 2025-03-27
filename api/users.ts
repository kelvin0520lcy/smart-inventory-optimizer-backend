import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, insertUserSchema } from '../../shared/schema';
import { hash } from 'bcrypt';
import { ZodError } from 'zod';

const router = Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const allUsers = await db.query.users.findMany({
      with: {
        products: true,
        suppliers: true,
      },
    });
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error instanceof Error ? error.message : String(error) });
  }
});

// Get a single user
router.get('/:id', async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, parseInt(req.params.id)),
      with: {
        products: true,
        suppliers: true,
      },
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Failed to fetch user', error: error instanceof Error ? error.message : String(error) });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  try {
    console.log('Creating user with data:', {
      ...req.body,
      password: '[REDACTED]'
    });

    const userData = insertUserSchema.parse(req.body);
    console.log('Validation passed');

    const hashedPassword = await hash(userData.password, 10);
    console.log('Password hashed successfully');
    
    const [newUser] = await db.insert(users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning();
    
    console.log('User created successfully:', {
      ...newUser,
      password: '[REDACTED]'
    });
    
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      body: { ...req.body, password: '[REDACTED]' }
    });

    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }

    // Check for unique violation error
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      return res.status(409).json({
        message: 'Username already exists',
        error: 'A user with this username already exists'
      });
    }

    res.status(500).json({
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
    });
  }
});

// Update a user
router.put('/:id', async (req, res) => {
  try {
    console.log('Updating user with data:', {
      id: req.params.id,
      ...req.body,
      password: req.body.password ? '[REDACTED]' : undefined
    });

    const userData = insertUserSchema.partial().parse(req.body);
    console.log('Validation passed');

    if (userData.password) {
      userData.password = await hash(userData.password, 10);
      console.log('Password hashed successfully');
    }
    
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, parseInt(req.params.id)))
      .returning();
      
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User updated successfully:', {
      ...updatedUser,
      password: '[REDACTED]'
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.params.id,
      body: { ...req.body, password: req.body.password ? '[REDACTED]' : undefined }
    });

    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }

    // Check for unique violation error
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      return res.status(409).json({
        message: 'Username already exists',
        error: 'A user with this username already exists'
      });
    }

    res.status(500).json({
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
    });
  }
});

// Delete a user
router.delete('/:id', async (req, res) => {
  try {
    console.log('Deleting user:', req.params.id);

    const [deletedUser] = await db.delete(users)
      .where(eq(users.id, parseInt(req.params.id)))
      .returning();
      
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User deleted successfully:', {
      ...deletedUser,
      password: '[REDACTED]'
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.params.id
    });

    res.status(500).json({
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
    });
  }
});

export default router; 