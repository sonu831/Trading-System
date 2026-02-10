const BaseService = require('../../common/services/BaseService');
const axios = require('axios');

class SystemService extends BaseService {
  constructor({ systemRepository, logger, redis, stocksService }) {
    super({ logger, redis });
    this.systemRepository = systemRepository;
    this.stocksService = stocksService;
  }

  /**
   * Get the aggregated system status
   * @returns {Promise<Object>} System status object
   */
  async getSystemStatus() {
    // Parallel fetching for performance
    const [logs, l1, l2, l4, l5, l6, l7, backfill, candleCount] = await Promise.all([
      this.systemRepository.getLogs(),
      this.systemRepository.getMetric('system:layer1:metrics'),
      this.systemRepository.getMetric('system:layer2:metrics'),
      this.systemRepository.getMetric('system:layer4:metrics'),
      this.systemRepository.getMetric('system:layer5:metrics'),
      this.systemRepository.getMetric('system:layer6:metrics'),
      this.systemRepository.getMetric('layer7_api_http_request_duration_seconds'),
      this.systemRepository.getMetric('system:layer1:backfill'),
      this.systemRepository.getCandleCount(),
    ]);

    // Defaults
    const safeL1 = l1 || { type: 'Stream', source: 'MStock', status: 'Unknown' };
    const safeL2 = l2 || { status: 'Unknown' };
    const safeL4 = l4 || { status: 'Unknown' };
    const safeL5 = l5 || { status: 'Unknown' };
    const safeL6 = l6 || { status: 'Unknown' };
    const safeL7 = l7 || { status: 'Unknown' };

    return {
      layers: {
        layer1: { name: 'Ingestion', status: 'ONLINE', metrics: safeL1, backfill, logs },
        layer2: { name: 'Processing', status: 'ONLINE', metrics: safeL2 },
        layer3: {
          name: 'Storage',
          status: 'ONLINE',
          metrics: { db_rows: candleCount, type: 'TimeScaleDB' },
        },
        layer4: { name: 'Analysis', status: 'ONLINE', metrics: safeL4 },
        layer5: { name: 'Aggregation', status: 'ONLINE', metrics: safeL5 },
        layer6: { name: 'Signal', status: 'ONLINE', metrics: safeL6 },
        layer7: { name: 'Presentation', status: 'ONLINE', metrics: safeL7 },
      },
      infra: { kafka: 'ONLINE', redis: 'ONLINE', timescaledb: 'ONLINE' },
    };
  }

  /**
   * Get the swarm status from the repository
   * @returns {Promise<Object>} Swarm status object
   */
  async getSwarmStatus() {
    // defaults to null (IDLE) if not found
    return this.systemRepository.getSwarmStatus() || { status: 'IDLE' };
  }

  /**
   * Trigger a backfill job
   * @param {Object} payload - { symbol, fromDate, toDate, type, force }
   * @returns {Promise<Object>} Trigger result including jobId
   */
  async triggerBackfill(payload) {
    // Default to HISTORICAL if not specified (User Request)
    const type = payload.type || 'HISTORICAL';

    // Create job record before triggering
    const job = await this.systemRepository.createBackfillJob({
      symbols: payload.symbol ? [payload.symbol] : [],
      startDate: payload.fromDate,
      endDate: payload.toDate,
      type: type,
      triggeredBy: 'api',
    });

    if (type === 'HISTORICAL') {
      try {
        // Direct call to Ingestion Service (Layer 1)
        // Resolves to: http://ingestion:9101/api/backfill/historical
        const response = await axios.post('http://ingestion:9101/api/backfill/historical', {
          symbol: payload.symbol,
          fromDate: payload.fromDate,
          toDate: payload.toDate,
          force: payload.force, // Pass force flag
          jobId: job.job_id,
        });

        return {
          message: 'Historical Backfill triggered successfully',
          jobId: job.job_id,
          details: response.data
        };
      } catch (error) {
        // Update job status if trigger fails
        await this.systemRepository.updateBackfillJob(job.job_id, { status: 'FAILED' });
        throw new Error(`Failed to trigger ingestion service: ${error.message}`);
      }
    }

    // Legacy / Other Types (via Redis)
    await this.systemRepository.triggerBackfill({
      ...payload,
      jobId: job.job_id,
    });

    return {
      message: 'Backfill triggered successfully (Legacy)',
      jobId: job.job_id,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA AVAILABILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get data availability summary + list of symbols
   * This logic maps raw DB records to the format expected by the frontend.
   * 
   * @param {string?} symbol - Optional symbol filter
   * @returns {Promise<Object>} { summary, symbols }
   */
  async getDataAvailability(symbol = null) {
    // 1. Get DB Records
    const records = await this.systemRepository.getDataAvailability(symbol);
    
    // 2. Get Master List (Nifty 50) from StocksService
    const masterSymbols = await this.stocksService.getSymbols().catch(() => []);
    
    // 3. Create Map of DB records for O(1) lookup
    const dbMap = new Map();
    records.forEach(r => dbMap.set(r.symbol, r));

    // 4. Merge: Ensure all Master Symbols are present
    const mergedList = [];
    
    // If a specific symbol is requested, only check that one
    const targetSymbols = symbol ? [symbol] : masterSymbols;

    for (const s of targetSymbols) {
      if (dbMap.has(s)) {
        // Use DB record
        const r = dbMap.get(s);
        mergedList.push({
          ...r,
          total_candles: r.total_records ? Number(r.total_records) : 0, 
          earliest: r.first_date, 
          latest: r.last_date,
        });
      } else {
        // Add "Missing" record
        // Only if it's in the master list (or was specifically requested)
        if (masterSymbols.includes(s) || symbol === s) {
          mergedList.push({
            symbol: s,
            total_candles: 0,
            earliest: null,
            latest: null,
            total_records: 0,
            status: 'critical' // Explicitly mark as critical/missing
          });
        }
      }
    }
    
    // Also include any "Extra" symbols from DB that are NOT in master list (orphans/legacy)
    if (!symbol) {
      records.forEach(r => {
        if (!masterSymbols.includes(r.symbol)) {
           mergedList.push({
            ...r,
            total_candles: r.total_records ? Number(r.total_records) : 0, 
            earliest: r.first_date, 
            latest: r.last_date,
          });
        }
      });
    }

    // Sort by Symbol (A-Z)
    mergedList.sort((a, b) => a.symbol.localeCompare(b.symbol));

    // Calculate aggregated summary for the entire dataset
    const summary = {
      totalSymbols: mergedList.length,
      totalRecords: mergedList.reduce((sum, r) => sum + Number(r.total_records || 0), 0),
      earliestDate: records.length ? records.reduce((min, r) => r.first_date < min ? r.first_date : min, records[0].first_date) : null,
      latestDate: records.length ? records.reduce((max, r) => r.last_date > max ? r.last_date : max, records[0].last_date) : null,
      // Add count metrics
      healthyCount: mergedList.filter(s => s.status === 'healthy').length,
      warningCount: mergedList.filter(s => s.status === 'warning').length,
      criticalCount: mergedList.filter(s => s.status === 'critical').length,
    };

    return { summary, symbols: mergedList };
  }

  /**
   * Get a specific backfill job by ID
   * @param {string} jobId - The job UUID
   * @returns {Promise<Object>} Job details
   */
  async getBackfillJob(jobId) {
    const job = await this.systemRepository.getBackfillJob(jobId);
    if (!job) {
      const error = new Error('Backfill job not found');
      error.statusCode = 404;
      throw error;
    }
    return job;
  }

  /**
   * Get list of backfill jobs
   * @param {string?} status - Optional status filter
   * @param {number} limit - Max records
   * @returns {Promise<Array>} List of backfill jobs
   */
  async getBackfillJobs(status = null, limit = 20) {
    return this.systemRepository.getBackfillJobs(status, limit);
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE METHODS (For Ingestion Layer HTTP Calls)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Refresh data availability from source of truth
   * @param {string} symbol
   * @returns {Promise<Object>}
   */
  async refreshDataAvailability(symbol) {
    return this.systemRepository.refreshDataAvailability(symbol);
  }

  /**
   * Sync all data availability (Cron Job)
   * @returns {Promise<number>} Number of symbols synced
   */
  async syncAllDataAvailability() {
    return this.systemRepository.syncAllDataAvailability();
  }

  /**
   * Get Data Sync Job Status
   * @returns {Promise<Object>} Job status
   */
  async getDataSyncStatus() {
    return this.systemRepository.getDataSyncJobStatus();
  }

  /**
   * Update data availability (Deprecated)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async updateDataAvailability(params) {
    return this.systemRepository.updateDataAvailability(params);
  }

  /**
   * Update backfill job status
   * @param {string} jobId - The job UUID
   * @param {Object} params - { status, processed, errors }
   * @returns {Promise<Object>}
   */
  async updateBackfillJob(jobId, params) {
    return this.systemRepository.updateBackfillJob(jobId, params);
  }

  /**
   * Get symbols with data gaps
   * @param {number} tradingDays - Number of trading days to check
   * @returns {Promise<Array>} List of symbols
   */
  async getSymbolsWithGaps(tradingDays) {
    return this.systemRepository.getSymbolsWithGaps(tradingDays);
  }

  /**
   * Clear System Caches
   * Called by API POST /system/cache/clear
   * @returns {Promise<Object>} Result message
   */
  async clearSystemCache() {
    this.logger.info('🧹 Manual Cache Clear Requested');
    
    // Clear Data Availability Cache
    await this.systemRepository.clearCachePattern('api:data:*');
    
    // Clear System Metrics Cache
    await this.systemRepository.clearCachePattern('system:metrics:*');
    
    // Clear Job Status Cache (optional, but good for fresh state)
    // await this.systemRepository.clearCachePattern('system:jobs:*');

    return { message: 'Cache cleared successfully', timestamp: new Date() };
  }
}

module.exports = SystemService;
