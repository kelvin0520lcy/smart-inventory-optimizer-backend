import express from 'express';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/', async (req, res) => {
  try {
    const { action, context } = req.body;

    let prompt = '';
    switch (action) {
      case 'price':
        prompt = `As an inventory management AI, analyze the following context and provide a price change recommendation. Consider market conditions, competition, and historical data:\n\n${context}`;
        break;
      case 'stock':
        prompt = `As an inventory management AI, analyze the following context and provide a stock order recommendation. Consider current inventory levels, sales history, and lead times:\n\n${context}`;
        break;
      case 'forecast':
        prompt = `As an inventory management AI, analyze the following context and provide a sales forecast. Consider historical sales data, seasonal trends, and market conditions:\n\n${context}`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert inventory management AI assistant. Provide clear, actionable recommendations based on the given context. Include specific numbers and reasoning in your response."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const recommendation = completion.choices[0].message.content;

    return res.json({ recommendation });
  } catch (error) {
    console.error('AI Agent Error:', error);
    return res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

export default router; 