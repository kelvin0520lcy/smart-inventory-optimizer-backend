import { runBackgroundAnalysis } from './background-ai-agent.js';

let backgroundInterval;
const SIX_HOURS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export function startBackgroundService() {
  console.log('Starting background AI service...');
  
  // Run immediately on startup
  runInitialAnalysis();
  
  // Then set interval for regular runs
  backgroundInterval = setInterval(() => {
    console.log('Running scheduled background AI analysis...');
    runBackgroundAnalysis()
      .then(() => {
        console.log('Scheduled background AI analysis completed successfully');
      })
      .catch((error) => {
        console.error('Error in scheduled background AI analysis:', error);
      });
  }, SIX_HOURS);
  
  console.log(`Background AI service scheduled to run every ${SIX_HOURS / (60 * 60 * 1000)} hours`);
}

function runInitialAnalysis() {
  console.log('Running initial background AI analysis...');
  runBackgroundAnalysis()
    .then(() => {
      console.log('Initial background AI analysis completed successfully');
    })
    .catch((error) => {
      console.error('Error in initial background AI analysis:', error);
    });
}

export function stopBackgroundService() {
  if (backgroundInterval) {
    clearInterval(backgroundInterval);
    console.log('Background AI service stopped');
  }
} 