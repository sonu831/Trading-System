const { TimeSlicer } = require('../utils/time-slicer');
const pLimit = require('p-limit');
const { MarketHours } = require('../utils/market-hours');
const { HistoricalChunker } = require('../utils/historical-chunker');
const { ResponseBuilder } = require('../utils/response-builder');
const { RequestUtils } = require('../utils/request-utils');
const { DateTime } = require('luxon');
const { logger } = require('../utils/logger');

class BaseVendor {
  constructor(options) {
    this.name = 'BaseVendor';
    this.options = options;
    this.onTick = options.onTick;
    this.marketHours = new MarketHours();
    this.redisClient = options.redisClient || null; // For Swarm Visibility
    this.concurrencyLimit = pLimit(12); // Default Swarm Size (12 months)
  }

  // Abstract Methods
  async connect() {
    throw new Error('Method connect() must be implemented');
  }
  async disconnect() {
    throw new Error('Method disconnect() must be implemented');
  }
  subscribe(symbols) {
    throw new Error('Method subscribe() must be implemented');
  }
  isConnected() {
    return false;
  }

  /**
   * Fetch Unified Data (Intelligent Routing with Swarm Mode)
   */
  async fetchData(params) {
    // 1. Normalize Inputs
    const normParams = RequestUtils.normalizeHistoricalParams(params);
    const marketStatus = this.marketHours.getMarketStatus();

    // 2. Explicit Date Range = Historical
    if ((params.fromDate || params.fromdate) && (params.toDate || params.todate)) {
      const start = DateTime.fromISO(normParams.fromdate);
      const end = DateTime.fromISO(normParams.todate);
      const diffInDays = end.diff(start, 'days').days;

      logger.info(
        `BaseVendor: Fetching Historical Data (${normParams.fromdate} to ${normParams.todate} | ${Math.ceil(diffInDays)} days)`
      );

      // SWARM MODE DECISION
      // Default: true, unless explicitly set to false
      const useSwarm = params.useSwarm !== false && params.useSwarm !== 'false';

      if (useSwarm) {
        if (diffInDays > 35) {
           logger.info(`🚀 Enabling Swarm Mode: MONTHLY Strategy (${Math.ceil(diffInDays)} days)`);
           return await this.swarmFetch(normParams, 'MONTHLY');
        } else if (diffInDays > 7) {
           logger.info(`🚀 Enabling Swarm Mode: WEEKLY Strategy (${Math.ceil(diffInDays)} days)`);
           return await this.swarmFetch(normParams, 'WEEKLY');
        }
      } else {
        logger.info(`🐢 Swarm Mode DISABLED via flag. Using Sequential Fetch.`);
      }

      // Standard Sequential Mode for short ranges or if Swarm disabled
      return await this._getChunkedHistoricalData(normParams);
    }

    // 3. Market Open = Real-time
    if (marketStatus.isOpen) {
      logger.info('BaseVendor: Market Open - Requesting Real-time (Intraday) Data');
      if (this.getIntradayChartData) {
        return await this.getIntradayChartData(normParams);
      } else {
        logger.warn(`${this.name} does not support getIntradayChartData, falling back to recent history.`);
        const today = DateTime.now().toISODate();
        return await this._getChunkedHistoricalData({
          ...normParams,
          fromdate: today,
          todate: today,
        });
      }
    } else {
      // 4. Market Closed = Recent History
      logger.info('BaseVendor: Market Closed - Fetching recent Historical Data');
      const end = DateTime.now();
      const start = end.minus({ days: 3 });
      return await this._getChunkedHistoricalData({
        ...normParams,
        fromdate: start.toISODate(),
        todate: end.toISODate(),
      });
    }
  }

  /**
   * High-Performance Parallel Fetcher
   * @param {Object} params 
   * @param {string} strategy 'MONTHLY' | 'WEEKLY'
   */
  /**
   * High-Performance Parallel Fetcher with Retry Logic
   * @param {Object} params 
   * @param {string} strategy 'MONTHLY' | 'WEEKLY'
   */
  async swarmFetch(params, strategy) {
    const partitions = TimeSlicer.slice(params, strategy);
    const MAX_RETRIES = 3;
    const BACKOFF_MS = 2000;
    
    logger.info(`🐝 Swarm: Spawning ${partitions.length} parallel workers (${strategy})...`);

    // Initialize Swarm State
    const swarmState = {
      jobId: params.jobId || `swarm-${Date.now()}`,
      symbol: params.symbol || 'UNKNOWN',
      strategy,
      totalPartitions: partitions.length,
      startTime: Date.now(),
      status: 'RUNNING',
      attempt: 1,
      partitions: partitions.map((p, i) => ({
        id: i + 1,
        range: `${p.fromDate} to ${p.toDate}`,
        status: 'PENDING', // PENDING, WORKING, COMPLETED, FAILED
        candles: 0,
        error: null
      }))
    };

    // Helper to Publish State
    const publishState = async () => {
      if (this.redisClient) {
        try {
          await this.redisClient.set('system:layer1:swarm_status', JSON.stringify(swarmState));
          // Optional: Publish event for WebSockets
          await this.redisClient.publish('swarm:updates', JSON.stringify(swarmState));
        } catch (e) {
          logger.warn(`Failed to publish swarm state: ${e.message}`);
        }
      }
    };

    // Store results by partition ID (0-based index)
    const partitionResults = new Array(partitions.length).fill(null);

    // ─────────────────────────────────────────────────────────────
    // RETRY LOOP
    // ─────────────────────────────────────────────────────────────
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      swarmState.attempt = attempt;
      
      // Identify partitions to process (Pending or Failed)
      // On Attempt 1: All partitions
      // On Attempt >1: Only Failed partitions
      const indicesToProcess = swarmState.partitions
        .map((p, i) => (p.status !== 'COMPLETED' ? i : -1))
        .filter(i => i !== -1);

      if (indicesToProcess.length === 0) {
        logger.info('🐝 Swarm: All partitions completed successfully.');
        break;
      }

      if (attempt > 1) {
        swarmState.status = 'RETRYING';
        const delay = (attempt - 1) * BACKOFF_MS;
        logger.warn(`🐝 Swarm: Attempt ${attempt}/${MAX_RETRIES} - Retrying ${indicesToProcess.length} partitions in ${delay}ms...`);
        await publishState();
        await new Promise(r => setTimeout(r, delay));
      }

      // Execute Workers for this batch
      const tasks = indicesToProcess.map((index) => {
        const partition = partitions[index];
        
        return this.concurrencyLimit(async () => {
          // Update State: WORKING
          swarmState.partitions[index].status = 'WORKING';
          swarmState.partitions[index].error = null; // Clear previous error
          await publishState();

          // JITTER: Random delay 0-2000ms only on first attempt to avoid thundering herd
          if (attempt === 1) {
            const jitter = Math.floor(Math.random() * 2000);
            await new Promise(r => setTimeout(r, jitter));
          }

          logger.info(`🐝 Worker ${index+1}/${partitions.length} (Ampt ${attempt}): Fetching ${partition.fromDate}...`);
          
          let response;
          try {
            // RECURSIVE CALL
            response = await this._getChunkedHistoricalData({
              ...params,
              fromdate: partition.fromDate,
              todate: partition.toDate
            });
          } catch (err) {
              response = { status: false, message: err.message };
          }

          // Evaluate Success
          const count = (response && response.status && Array.isArray(response.data?.candles)) 
            ? response.data.candles.length 
            : 0;
          
          // We consider it success if we got a valid array (even empty, though ideally we want data)
          // If connection failed, response.status would be false.
          const success = response && response.status === true; 
          const statusIcon = success ? '✅' : '⚠️';
          
          logger.info(`🐝 Worker ${index+1}/${partitions.length}: Finished - ${statusIcon} ${count} candles`);

          // Update State
          swarmState.partitions[index].status = success ? 'COMPLETED' : 'FAILED';
          swarmState.partitions[index].candles = count;
          if (!success) swarmState.partitions[index].error = response?.message || 'Fetch Failed';
          
          // Store Result if successful (or overwrite if improved)
          if (success) {
            partitionResults[index] = response.data.candles;
          }

          await publishState();
        });
      });

      // Wait for all tasks in this attempt to finish
      await Promise.all(tasks);
    }
    // ─────────────────────────────────────────────────────────────

    // Final State Update
    const finalFailures = swarmState.partitions.filter(p => p.status !== 'COMPLETED').length;
    swarmState.status = finalFailures === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS';
    swarmState.endTime = Date.now();
    await publishState();
    
    // Aggregation Logic & Reporting
    let totalCandles = [];
    let failureCount = 0;
    
    logger.info('════════════════════════════════════════════════════════════');
    logger.info(`🐝 SWARM REPORT SUMMARY (Attempts: ${swarmState.attempt})`);
    logger.info('════════════════════════════════════════════════════════════');
    logger.info('  # | Partition Start       | Status | Candles | Error');
    logger.info('------------------------------------------------------------');

    swarmState.partitions.forEach((p, i) => {
      const idx = (i + 1).toString().padStart(3, ' ');
      const dateStr = partitions[i].fromDate.padEnd(20, ' ');
      const icon = p.status === 'COMPLETED' ? '✅' : '🔴';
      const countStr = p.candles.toString().padStart(6, ' ');
      const errStr = p.error ? `(${p.error})` : '';
      
      logger.info(`${idx} | ${dateStr} |   ${icon}   | ${countStr} ${errStr}`);

      if (p.status === 'COMPLETED' && partitionResults[i]) {
        totalCandles.push(...partitionResults[i]);
      } else {
        failureCount++;
      }
    });

    logger.info('════════════════════════════════════════════════════════════');

    /**
     * Sort merged candles chronologically.
     * Candle format varies by vendor — may be an array [time, O, H, L, C, V]
     * or an object with datetime/timestamp/Date/time keys.
     */
    totalCandles.sort((a, b) => {
      const getTime = (c) => {
        if (Array.isArray(c)) return new Date(c[0]).getTime();
        const raw = c.datetime || c.timestamp || c.Date || c.time;
        return raw ? new Date(raw).getTime() : 0;
      };
      return getTime(a) - getTime(b);
    });
    
    logger.info(`🐝 Swarm Complete. Merged ${totalCandles.length} candles. Failures: ${failureCount}`);
    
    return ResponseBuilder.historical(totalCandles);
  }

  /**
   * Helper: Handle API Limitations via Chunking
   * @private
   */
  async _getChunkedHistoricalData(params) {
    try {
      RequestUtils.validateHistoricalParams(params);
    } catch (e) {
      return ResponseBuilder.error(e.message, 'IA400');
    }

    const chunks = HistoricalChunker.splitRange({
      fromDate: params.fromdate,
      toDate: params.todate,
      interval: params.interval,
    });

    if (chunks.length === 0) {
      return ResponseBuilder.error('Invalid Date Range', 'IA400');
    }

    if (chunks.length <= 1) {
      // Optimization: direct call if only 1 chunk
      return await this.getHistoricalData(params);
    }

    logger.info(`BaseVendor: Splitting request into ${chunks.length} chunks.`);

    let combinedCandles = [];
    let zeroDataChunks = [];
    let failedChunks = [];
    const MAX_RETRIES = 2;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkParams = {
        ...params,
        fromdate: chunk.fromDate,
        todate: chunk.toDate,
      };

      const chunkDate = DateTime.fromISO(chunkParams.fromdate);
      const today = DateTime.now().startOf('day');
      if (chunkDate > today) {
        logger.debug(`BaseVendor: Chunk ${i + 1}/${chunks.length}: SKIPPED (future date)`);
        continue;
      }

      logger.debug(`Requesting Chunk ${i + 1}/${chunks.length}: From [${chunkParams.fromdate}] To [${chunkParams.todate}]`);

      // Rate Limiting Delay
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      let success = false;
      let lastError = null;
      let candleCount = 0;

      for (let retry = 0; retry <= MAX_RETRIES && !success; retry++) {
        try {
          if (retry > 0) {
            logger.info(`BaseVendor: Chunk ${i + 1}/${chunks.length}: RETRY ${retry}/${MAX_RETRIES}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          const response = await this.getHistoricalData(chunkParams);

          if (response && response.status && Array.isArray(response.data?.candles)) {
            candleCount = response.data.candles.length;
            combinedCandles.push(...response.data.candles);
            success = true;
            
            if (candleCount === 0) {
              zeroDataChunks.push({ index: i + 1, from: chunkParams.fromdate });
              logger.info(`BaseVendor: Chunk ${i + 1}/${chunks.length} - ⚠️ 0 candles`);
            } else {
              logger.info(`BaseVendor: Chunk ${i + 1}/${chunks.length} - ✅ ${candleCount} candles`);
            }
          } else if (response && response.status === true && !response.data?.candles) {
            success = true; // Treated as empty success
            zeroDataChunks.push({ index: i + 1, from: chunkParams.fromdate });
            logger.info(`BaseVendor: Chunk ${i + 1}/${chunks.length} - ⚠️ null data`);
          } else {
            lastError = `Invalid response`;
            logger.warn(`BaseVendor: Chunk ${i + 1}/${chunks.length} - FAILED`);
          }
        } catch (e) {
          lastError = e.message;
          logger.warn(`BaseVendor: Chunk ${i + 1}/${chunks.length} - ERROR: ${e.message}`);
        }
      }

      if (!success) {
        failedChunks.push({ index: i + 1, from: chunkParams.fromdate, error: lastError });
        logger.error(`BaseVendor: Chunk ${i + 1}/${chunks.length} - ❌ FAILED final`);
      }
    }

    logger.info(`BaseVendor: Chunking complete. Total: ${combinedCandles.length} candles.`);
    return ResponseBuilder.historical(combinedCandles);
  }

  async getHistoricalData(_params) {
    throw new Error('getHistoricalData must be implemented');
  }
  async getIntradayChartData(_params) {
    throw new Error('getIntradayChartData must be implemented (optional)');
  }
}

module.exports = { BaseVendor };
