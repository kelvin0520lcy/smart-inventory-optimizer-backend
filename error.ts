import { Response } from 'express';
import { ZodError } from 'zod';

export function handleValidationError(err: unknown, res: Response) {
  console.error('Error:', err);
  
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors
    });
  }
  
  if (err instanceof Error) {
    return res.status(500).json({
      message: err.message
    });
  }
  
  return res.status(500).json({
    message: 'An unexpected error occurred'
  });
} 