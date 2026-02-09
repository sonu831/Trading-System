const BaseRepository = require('../../common/repositories/BaseRepository');

class SystemRepository extends BaseRepository {
  constructor({ redis, prisma, logger }) {
    super({ redis, prisma, logger });
  }

  /**
   * Get recent system logs from Redis
   * @param {number} limit - Number of logs to retrieve
   * @returns {Promise<Array<string>>} List of log strings
   */
  async getLogs(limit = 50) {
    return this.redis.getList('system:layer1:logs', 0, limit - 1);
  }

  /**
   * Get a specific metric from Redis
   * @param {string} key - Redis key for the metric
   * @returns {Promise<string|null>} Metric value or null
   */
  async getMetric(key) {
    try {
      const data = await this.redis.get(key);
      return data || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the count of signals generated
   * @returns {Promise<number>} Signal count
   */
  async getSignalCount() {
    try {
      return await this.redis.publisher.lLen('signals:history');
    } catch {
      return 0;
    }
  }

  /**
   * Get the total count of 1-minute candles in the database
   * Cached for 30 seconds to reduce DB load
   * @returns {Promise<number>} Candle count
   */
  async getCandleCount() {
    const ttl = Number(process.env.SYSTEM_CACHE_TTL_CANDLE_COUNT) || 30;
    return this.getCached('system:metrics:candle_count', async () => {
      try {
        return await this.prisma.candles_1m.count();
      } catch {
        return 0;
      }
    }, ttl);
  }

  /**
   * Trigger a backfill command via Redis Pub/Sub
   * @param {Object} params - Backfill parameters
   * @returns {Promise<void>}
   */
  async triggerBackfill(params) {
    await this.redis.publisher.publish(
      'system:commands',
      JSON.stringify({ command: 'START_BACKFILL', params, timestamp: Date.now() })
    );
  }

  /**
   * Get the current status of the Swarm (Ingestion Layer)
   * @returns {Promise<Object|null>} Swarm status object or null
   */
  async getSwarmStatus() {
    try {
      // RedisClient.get() already parses JSON
      const data = await this.redis.get('system:layer1:swarm_status');
      return data || null;
    } catch (e) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CACHING HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generic Cache Wrapper
   * @param {string} key - Redis key
   * @param {Function} fetchFn - Function to fetch data if cache miss
   * @param {number} ttl - Time to live in seconds (default 300s = 5m)
   * @returns {Promise<any>} The data (cached or fresh)
   */
  async getCached(key, fetchFn, ttl = Number(process.env.SYSTEM_DEFAULT_CACHE_TTL) || 300) {
    try {
      // 1. Try Cache
      const cached = await this.redis.get(key);
      if (cached) {
        try {
          return JSON.parse(cached); // Fix: Parse the string back to object
        } catch (e) {
          this.logger.warn({ key, err: e }, 'Failed to parse cached value, fetching fresh');
        }
      }
      
      // 2. Fetch Fresh
      const data = await fetchFn();
      
      // 3. Set Cache (Async, don't block return)
      if (data) {
        this.redis.set(key, JSON.stringify(data), { EX: ttl }).catch(e => 
          this.logger.error({ err: e }, 'Failed to set cache')
        );
      }
      
      return data;
    } catch (err) {
      this.logger.error({ err, key }, 'Cache Error - Falling back to fresh fetch');
      return fetchFn();
    }
  }

  /**
   * Clear specific cache keys or patterns
   * @param {Array<string>} keys - List of keys to delete
   * @returns {Promise<void>}
   */
  async clearCache(keys = []) {
    if (!keys || keys.length === 0) return;
    try {
      for (const key of keys) {
        await this.redis.del(key);
      }
      this.logger.info({ keys }, '🧹 Cache Cleared');
    } catch (err) {
      this.logger.error({ err }, 'Failed to clear cache');
    }
  }

  /**
   * Clear keys matching a pattern
   * @param {string} pattern - Redis key pattern (e.g. 'system:*')
   * @returns {Promise<void>}
   */
  async clearCachePattern(pattern) {
    if (!pattern) return;
    try {
      let cursor = 0;
      let keys = [];
      do {
        // Use scan to find keys (non-blocking)
        const reply = await this.redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        keys.push(...reply.keys);
      } while (cursor !== 0);

      if (keys.length > 0) {
        await this.clearCache(keys);
        this.logger.info({ pattern, count: keys.length }, '🧹 Cache Pattern Cleared');
      }
    } catch (err) {
      this.logger.error({ err, pattern }, 'Failed to clear cache pattern');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA AVAILABILITY METHODS (Prisma-based)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get data availability for all symbols or a specific symbol
   * @param {string?} symbol - Optional symbol filter
   * @returns {Promise<Array>} List of data availability records
   */
  async getDataAvailability(symbol = null) {
    const cacheKey = symbol 
      ? `api:data:availability:${symbol}` 
      : `api:data:availability:all`;
      
    return this.getCached(cacheKey, async () => {
      const where = symbol ? { symbol } : {};
      return this.prisma.data_availability.findMany({
        where,
        orderBy: { symbol: 'asc' },
      });
    }, 300); // 5 min TTL
  }

  /**
   * Get a backfill job by ID
   * @param {string} jobId - The job UUID
   * @returns {Promise<Object|null>} The job record or null
   */
  async getBackfillJob(jobId) {
    return this.prisma.backfill_jobs.findFirst({
      where: { job_id: jobId },
    });
  }

  /**
   * Get backfill jobs with optional status filter
   * @param {string?} status - Optional status filter (PENDING, RUNNING, COMPLETED, FAILED)
   * @param {number} limit - Max records to return
   * @returns {Promise<Array>} List of backfill jobs
   */
  async getBackfillJobs(status = null, limit = 20) {
    const where = status ? { status } : {};
    return this.prisma.backfill_jobs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Create a new backfill job record
   * @param {Object} params - Job parameters
   * @returns {Promise<Object>} The created job
   */
  async createBackfillJob(params) {
    const { symbols, startDate, endDate, triggeredBy } = params;
    return this.prisma.backfill_jobs.create({
      data: {
        symbols: symbols || [],
        timeframe: '1m',
        start_date: startDate ? new Date(startDate) : null,
        end_date: endDate ? new Date(endDate) : null,
        status: 'PENDING',
        triggered_by: triggeredBy || 'api',
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE METHODS (Called by Ingestion Layer via HTTP)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Refresh data availability from source of truth (candles_1m)
   * @param {string} symbol - Symbol to refresh
   * @returns {Promise<Object|void>} Updated stats or void
   */
  async refreshDataAvailability(symbol) {
    if (!symbol) return;

    // 1. Get true stats from candles_1m
    const stats = await this.prisma.candles_1m.aggregate({
      where: { symbol },
      _count: { _all: true },
      _min: { time: true },
      _max: { time: true },
    });

    const count = Number(stats._count._all);
    if (count === 0) return; // No data, nothing to update

    // 2. Upsert into data_availability
    // We use a specific timeframe '1m' as default for now
    await this.prisma.data_availability.upsert({
      where: {
        symbol: symbol,
      },
      update: {
        first_date: stats._min.time,
        last_date: stats._max.time,
        total_records: BigInt(count),
        updated_at: new Date(),
      },
      create: {
        symbol: symbol,
        timeframe: '1m',
        first_date: stats._min.time,
        last_date: stats._max.time,
        total_records: BigInt(count),
        updated_at: new Date(),
      },
    });
    
    return { symbol, count, min: stats._min.time, max: stats._max.time };
  }

  /**
   * Sync all symbols from source of truth (candles_1m)
   * This is used by the periodic cron job.
   * @returns {Promise<number>} Number of symbols updated
   */
  async syncAllDataAvailability() {
    try {
      this.logger.info('🔄 Cron: Syncing Data Availability...');

      // 1. Get all unique symbols
      const symbols = await this.prisma.candles_1m.groupBy({
        by: ['symbol'],
      });

      let updatedCount = 0;
      for (const s of symbols) {
        await this.refreshDataAvailability(s.symbol);
        updatedCount++;
      }
      
      this.logger.info({ updatedCount }, '✅ Cron: Synced symbols');
      
      // Clear all data availability caches (list + individual symbols)
      await this.clearCachePattern('api:data:availability:*');
      
      return updatedCount;
    } catch (err) {
      this.logger.error({ err }, '❌ Error syncing data availability');
      throw err;
    }
  }

  /**
   * Get Data Sync Cron Job Status from Redis.
   * Retrieves the last run metadata (status, timestamp, result) stored by DataSyncJob.
   * @returns {Promise<Object>} Job status object
   */
  async getDataSyncJobStatus() {
    try {
      // RedisClient wrapper already parses JSON
      const data = await this.redis.get('system:jobs:datasync');
      return data || { status: 'UNKNOWN', message: 'No run history found' };
    } catch (err) {
      return { status: 'ERROR', error: err.message };
    }
  }

  /**
   * Update or create data availability record (Legacy: Manual Input)
   * @param {Object} params - Update parameters
   * @deprecated Use refreshDataAvailability for source-of-truth updates
   * @returns {Promise<Object>} Updated record
   */
  async updateDataAvailability(params) {
    let { symbol, timeframe = '1m', firstDate, lastDate } = params;

    // Normalize timeframe
    if (timeframe === 'ONE_MINUTE') timeframe = '1m';

    // 1. Get ACTUAL count from candles_1m table (Source of Truth)
    const actualCount = await this.prisma.candles_1m.count({
      where: { symbol }
    });

    // 2. Fetch existing record to perform "Smart Date Merging"
    // We need this because Prisma upsert 'update' cannot reference existing DB values directly.
    const existing = await this.prisma.data_availability.findUnique({
      where: { symbol },
    });

    let finalFirstDate = new Date(firstDate);
    let finalLastDate = new Date(lastDate);

    if (existing) {
      // If record exists, ensure we expand the range, not shrink it.
      // Take the EARLIER of the two start dates
      if (existing.first_date < finalFirstDate) {
        finalFirstDate = existing.first_date;
      }
      // Take the LATER of the two end dates
      if (existing.last_date > finalLastDate) {
        finalLastDate = existing.last_date;
      }
    }

    // 3. Upsert using the new UNIQUE(symbol) constraint
    // This handles both new records and updates atomically, preventing duplicates.
    return this.prisma.data_availability.upsert({
      where: { symbol },
      update: {
        first_date: finalFirstDate,
        last_date: finalLastDate,
        total_records: BigInt(actualCount),
        updated_at: new Date(),
        timeframe: '1m', // Enforce standard
      },
      create: {
        symbol,
        timeframe: '1m',
        first_date: new Date(firstDate),
        last_date: new Date(lastDate),
        total_records: BigInt(actualCount),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Update backfill job status and progress
   * @param {string} jobId - The job UUID
   * @param {Object} params - { status, processed, errors }
   * @returns {Promise<Object>} The updated job
   */
  async updateBackfillJob(jobId, params) {
    const { status, processed, errors } = params;
    const job = await this.prisma.backfill_jobs.findFirst({
      where: { job_id: jobId },
    });

    if (!job) {
      throw new Error(`Backfill job ${jobId} not found`);
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (processed !== undefined) updateData.processed = BigInt(processed);
    if (errors !== undefined) updateData.errors = errors;
    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completed_at = new Date();
    }
    if (status === 'RUNNING' && !job.started_at) {
      updateData.started_at = new Date();
    }

    return this.prisma.backfill_jobs.update({
      where: { id: job.id },
      data: updateData,
    });
  }

  /**
   * Get symbols that have data gaps (last_date older than cutoff)
   * @param {number} tradingDays - Number of trading days to check
   * @returns {Promise<Array>} List of symbols with gaps
   */
  async getSymbolsWithGaps(tradingDays = 5) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Math.ceil(tradingDays * 1.5));

    return this.prisma.data_availability.findMany({
      where: {
        timeframe: '1m',
        last_date: { lt: cutoffDate },
      },
      select: { symbol: true },
    });
  }
}

module.exports = SystemRepository;
