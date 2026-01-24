// server/utils/cleanup.js
const Application = require('../models/Application');

// ✅ Manual cleanup function (for immediate cleanup or debugging)
const cleanupRejectedApplications = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await Application.deleteMany({
      status: 'rejected',
      updatedAt: { $lt: thirtyDaysAgo }
    });
    
    console.log(`🧹 Cleaned up ${result.deletedCount} rejected applications`);
    return result.deletedCount;
  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  }
};

// ✅ Schedule daily cleanup (optional)
const scheduleDailyCleanup = () => {
  // Run cleanup every day at 2 AM
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(2, 0, 0, 0);
  
  if (now > nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  const delay = nextRun.getTime() - now.getTime();
  
  setTimeout(async () => {
    await cleanupRejectedApplications();
    // Schedule next run
    scheduleDailyCleanup();
  }, delay);
};

module.exports = { cleanupRejectedApplications, scheduleDailyCleanup };