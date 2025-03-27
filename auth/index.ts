import { db } from '../db/index.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { RequestWithSession } from '../../shared/types.js';

/**
 * Authenticate a user based on username and password
 */
export async function authenticateUser(username: string, password: string) {
  try {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = result[0];
    
    if (!user) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }
    
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      plan: user.plan
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Get the current authenticated user from request
 */
export async function getCurrentUser(req: RequestWithSession) {
  try {
    if (!req.session || !req.session.userId) {
      return null;
    }
    
    const userId = req.session.userId;
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = result[0];
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      plan: user.plan
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Helper function to get user ID from session
 */
export function getUserIdFromSession(req: RequestWithSession): string | null {
  if (!req.session || !req.session.userId) {
    return null;
  }
  return req.session.userId;
} 