import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { storage } from '../db/adapter.js';
import { RequestWithSession } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Login a user
 */
export const login = async (req: RequestWithSession, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        message: 'Username and password are required'
      });
    }
    
    // Get user from database
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({
        message: 'Invalid username or password'
      });
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({
        message: 'Invalid username or password'
      });
    }
    
    // Set session
    if (req.session) {
      req.session.userId = user.id;
    }
    
    // Return user data
    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      plan: user.plan
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
};

/**
 * Register a new user
 */
export const register = async (req: RequestWithSession, res: Response) => {
  try {
    const { username, password, email, fullName } = req.body;
    
    if (!username || !password || !email || !fullName) {
      return res.status(400).json({
        message: 'All fields are required'
      });
    }
    
    // Check if username or email already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        message: 'Username already exists'
      });
    }
    
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        message: 'Email already exists'
      });
    }
    
    // Create user
    const newUser = await storage.createUser({
      username,
      password,
      email,
      fullName,
      plan: 'free'
    });
    
    if (!newUser) {
      return res.status(500).json({
        message: 'Failed to create user'
      });
    }
    
    // Set session
    if (req.session) {
      req.session.userId = newUser.id;
    }
    
    // Return user data
    return res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName,
      plan: newUser.plan
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
};

/**
 * Logout a user
 */
export const logout = (req: RequestWithSession, res: Response) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({
          message: 'Failed to logout'
        });
      }
      
      return res.status(200).json({
        message: 'Logged out successfully'
      });
    });
  } else {
    return res.status(200).json({
      message: 'Logged out successfully'
    });
  }
};

/**
 * Get the current user
 */
export const getCurrentUser = async (req: RequestWithSession, res: Response) => {
  try {
    // Check if user is logged in
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        message: 'Not authenticated'
      });
    }
    
    // Get user from database
    const userId = String(req.session.userId);
    
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    const user = result[0];
    
    if (!user) {
      return res.status(401).json({
        message: 'User not found'
      });
    }
    
    // Return user data
    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      plan: user.plan
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
};

/**
 * Authenticate a user for protected routes
 */
export const authenticate = async (req: RequestWithSession) => {
  try {
    if (!req.session || !req.session.userId) {
      return null;
    }
    
    const userId = String(req.session.userId);
    
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}; 