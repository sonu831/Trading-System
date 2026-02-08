const cron = require('node-cron');

class DataSyncJob {
  /**
   * DataSyncJob
   * @description Periodically syncs `data_availability` table with `candles_1m` (Source of Truth).
   * Acts as a safety net for missed events or manual DB operations.
   * Scheduled to run every 5 minutes.
   * 
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.systemService - Service to trigger sync logic
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.redis - Redis client wrapper
   */
  constructor({ systemService, logger, redis }) {
    this.systemService = systemService;
    this.logger = logger;
    this.redis = redis;
    this.JOB_KEY = 'system:jobs:datasync';
    
    // Run every 5 minutes
    this.cronExpression = '*/5 * * * *';
    this.scheduledJob = null;
    this.init();
  }

  async updateStatus(status, extra = {}) {
    if (!this.redis.isConnected) {
      this.logger.warn('Redis not connected, attempting to connect...');
      await this.redis.connect();
    }
    
    // Safety check again
    if (!this.redis.isConnected) return;

    const payload = {
      job: 'DataSyncJob',
      status, 
      timestamp: new Date(),
      ...extra
    };
    await this.redis.set(this.JOB_KEY, JSON.stringify(payload));
  }

  async runJob() {
    this.logger.info('🕒 Cron Job: Triggering Data Availability Sync');
    const start = Date.now();
    
    try {
      await this.updateStatus('RUNNING', { startTime: new Date() });
      
      const count = await this.systemService.syncAllDataAvailability();
      
      const duration = Date.now() - start;
      const result = { 
        lastRun: new Date(), 
        lastDurationMs: duration, 
        lastResult: `${count} symbols synced`
      };
      await this.updateStatus('IDLE', result);
      return result;
    } catch (err) {
      this.logger.error({ err }, '❌ Cron Job Error');
      await this.updateStatus('FAILED', { 
        lastRun: new Date(), 
        error: err.message 
      });
      throw err;
    }
  }

  init() {
    // Schedule task to run using the defined expression
    cron.schedule(this.cronExpression, async () => {
      await this.runJob();
    });
    
    this.logger.info(`✅ Cron Job: Data Sync scheduled (${this.cronExpression})`);
  }
}

module.exports = DataSyncJob;
