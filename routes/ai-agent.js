import express from 'express';
import { db } from '../db-pg.js';
import { aiAnalyses } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Get AI analyses for a specific product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const analyses = await db.query.aiAnalyses.findMany({
      where: eq(aiAnalyses.productId, parseInt(productId)),
      orderBy: (aiAnalyses, { desc }) => [desc(aiAnalyses.timestamp)]
    });
    res.json(analyses);
  } catch (error) {
    console.error('Error fetching AI analyses:', error);
    res.status(500).json({ error: 'Failed to fetch AI analyses' });
  }
});

// Get all AI analyses
router.get('/', async (req, res) => {
  try {
    const analyses = await db.query.aiAnalyses.findMany({
      orderBy: (aiAnalyses, { desc }) => [desc(aiAnalyses.timestamp)]
    });
    res.json(analyses);
  } catch (error) {
    console.error('Error fetching AI analyses:', error);
    res.status(500).json({ error: 'Failed to fetch AI analyses' });
  }
});

// Get critical recommendations
router.get('/critical', async (req, res) => {
  try {
    const criticalAnalyses = await db.query.aiAnalyses.findMany({
      where: (aiAnalyses, { eq }) => eq(aiAnalyses.isCritical, true),
      orderBy: (aiAnalyses, { desc }) => [desc(aiAnalyses.timestamp)]
    });
    res.json(criticalAnalyses);
  } catch (error) {
    console.error('Error fetching critical recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch critical recommendations' });
  }
});

export default router; 