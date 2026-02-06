const BaseRepository = require('../../common/repositories/BaseRepository');

class SystemRepository extends BaseRepository {
  constructor({ redis, prisma }) {
    super({ redis, prisma });
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
  // DATA AVAILABILITY METHODS (Prisma-based)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get data availability for all symbols or a specific symbol
   * @param {string?} symbol - Optional symbol filter
   * @returns {Promise<Array>} List of data availability records
   */
  async getDataAvailability(symbol = null) {
    const where = symbol ? { symbol } : {};
    return this.prisma.data_availability.findMany({
      where,
      orderBy: { symbol: 'asc' },
    });
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
  async updateDataAvailability(params) {
    const { symbol, timeframe = '1m', firstDate, lastDate, recordCount } = params;
    
    // Check if record exists for this symbol + timeframe
    const existing = await this.prisma.data_availability.findFirst({
      where: { symbol, timeframe },
    });

    if (existing) {
      // UPDATE: Smart merge of data availability
      // - first_date: take the earlier of the two
      // - last_date: take the later of the two
      // - total_records: increment the count
      return this.prisma.data_availability.update({
        where: { id: existing.id },
        data: {
          first_date: firstDate < existing.first_date ? new Date(firstDate) : existing.first_date,
          last_date: lastDate > existing.last_date ? new Date(lastDate) : existing.last_date,
          // BigInt addition for safety
          total_records: (existing.total_records || BigInt(0)) + BigInt(recordCount || 0),
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
          total_records: BigInt(recordCount || 0),
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
