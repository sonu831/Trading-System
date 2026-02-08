const BaseRepository = require('../../common/repositories/BaseRepository');

class SystemRepository extends BaseRepository {
  constructor({ redis, prisma, logger }) {
    super({ redis, prisma, logger });
  }

  async getLogs(limit = 50) {
    return this.redis.getList('system:layer1:logs', 0, limit - 1);
  }

  async getMetric(key) {
    try {
      const data = await this.redis.get(key);
      return data || null;
    } catch (e) {
      return null;
    }
  }

  async getSignalCount() {
    try {
      return await this.redis.publisher.lLen('signals:history');
    } catch {
      return 0;
    }
  }

  async getCandleCount() {
    try {
      return await this.prisma.candles_1m.count();
    } catch {
      return 0;
    }
  }

  async triggerBackfill(params) {
    await this.redis.publisher.publish(
      'system:commands',
      JSON.stringify({ command: 'START_BACKFILL', params, timestamp: Date.now() })
    );
  }

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
   */
  async getCached(key, fetchFn, ttl = 300) {
    try {
      // 1. Try Cache
      const cached = await this.redis.get(key);
      if (cached) return cached;
      
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
   * @param {string} pattern - Key pattern to delete (e.g. 'system:*')
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
   * Update or create data availability record (Upsert Logic)
   * Called by Ingestion Service (Layer 1) after processing a batch.
   * 
   * Logic:
   * - If record exists: Expand date range (min/max) and ADD to total_records count.
   * - If new: Create fresh record.
   * 
   * @param {Object} params - { symbol, timeframe, firstDate, lastDate, recordCount }
   * @returns {Promise<Object>} The updated record
   */
  /**
   * Refresh data availability from source of truth (candles_1m)
   * @param {string} symbol - Symbol to refresh
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
        symbol_timeframe: {
          symbol: symbol,
          timeframe: '1m',
        },
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
   * @deprecated Use refreshDataAvailability for source-of-truth updates
   */
  async updateDataAvailability(params) {
    const { symbol, timeframe = '1m', firstDate, lastDate } = params;

    // 1. Get ACTUAL count from candles_1m table (Source of Truth)
    // This prevents "double counting" drift when backfilling existing data
    const actualCount = await this.prisma.candles_1m.count({
      where: { symbol }
    });
    
    // Check if record exists for this symbol + timeframe
    const existing = await this.prisma.data_availability.findFirst({
      where: { symbol, timeframe },
    });

    if (existing) {
      // UPDATE: Smart merge of data availability
      // - first_date: take the earlier of the two
      // - last_date: take the later of the two
      // - total_records: SET to actual count (not increment)
      return this.prisma.data_availability.update({
        where: { id: existing.id },
        data: {
          first_date: firstDate < existing.first_date ? new Date(firstDate) : existing.first_date,
          last_date: lastDate > existing.last_date ? new Date(lastDate) : existing.last_date,
          total_records: BigInt(actualCount),
          updated_at: new Date(),
        },
      });
    } else {
      // INSERT: New symbol tracking
      return this.prisma.data_availability.create({
        data: {
          symbol,
          timeframe,
          first_date: new Date(firstDate),
          last_date: new Date(lastDate),
          total_records: BigInt(actualCount),
          updated_at: new Date(),
        },
      });
    }
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
