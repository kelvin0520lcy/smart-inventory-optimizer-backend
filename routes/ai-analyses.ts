import express from 'express';
import { db } from '../db-pg.js';
import { aiAnalyses } from '../drizzle/schema.js';
import { desc } from 'drizzle-orm';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Get the most recent analyses for each product
    const analyses = await db
      .select()
      .from(aiAnalyses)
      .orderBy(desc(aiAnalyses.timestamp))
      .limit(10);

    res.json(analyses);
  } catch (error) {
    console.error('Error fetching AI analyses:', error);
    res.status(500).json({ error: 'Failed to fetch AI analyses' });
  }
});

export default router; 