import { runBackgroundAnalysis } from './background-ai-agent.js';

// Run analysis every 6 hours
const ANALYSIS_INTERVAL = 6 * 60 * 60 * 1000;

export function startBackgroundService() {
  console.log('Starting background AI analysis service...');
  
  // Run initial analysis
  runBackgroundAnalysis().catch(error => {
    console.error('Initial background analysis failed:', error);
  });

  // Schedule periodic analysis
  setInterval(() => {
    console.log('Running scheduled background analysis...');
    runBackgroundAnalysis().catch(error => {
      console.error('Scheduled background analysis failed:', error);
    });
  }, ANALYSIS_INTERVAL);
} 