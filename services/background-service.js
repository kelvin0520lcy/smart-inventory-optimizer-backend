let backgroundInterval;
const SIX_HOURS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export function startBackgroundService() {
  console.log('Starting background service...');
  
  // Set interval for regular background tasks
  backgroundInterval = setInterval(() => {
    console.log('Running scheduled background tasks...');
    // Background tasks can be added here if needed
    console.log('Scheduled background tasks completed');
  }, SIX_HOURS);
  
  console.log(`Background service scheduled to run every ${SIX_HOURS / (60 * 60 * 1000)} hours`);
}

export function stopBackgroundService() {
  if (backgroundInterval) {
    clearInterval(backgroundInterval);
    console.log('Background service stopped');
  }
} 