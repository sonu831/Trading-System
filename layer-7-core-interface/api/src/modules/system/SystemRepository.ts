const BaseRepository = require('../../common/repositories/BaseRepository');

class SystemRepository extends BaseRepository {
  constructor({ redis, prisma }) {
    super({ redis, prisma });
  }

  async getLogs(limit = 50) {
    try {
      return await this.redis.lRange('system:layer1:logs', 0, limit - 1);
    } catch { return []; }
  }

  async getMetric(key) {
    try {
      const data = await this.redis.get(key);
      return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
    } catch { return null; }
  }

  async getCandleCount() {
    try { return await this.prisma.candles_1m.count(); }
    catch { return 0; }
  }

  async getSwarmStatus() {
    try {
      const data = await this.redis.get('system:layer1:swarm_status');
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch { return null; }
  }

  async pingRedis() {
    try { await this.redis.ping(); return true; }
    catch { return false; }
  }

  async pingTimescaleDB() {
    try { await this.prisma.$queryRaw`SELECT 1`; return true; }
    catch { return false; }
  }

  /** ── DATA AVAILABILITY ── */
  async getDataAvailability(symbol = null) {
    const where = symbol ? { symbol } : {};
    return this.prisma.data_availability.findMany({
      where, orderBy: { symbol: 'asc' },
    });
  }

  /** ── BACKFILL JOBS ── */
  async getBackfillJob(jobId) {
    return this.prisma.backfill_jobs.findFirst({ where: { job_id: jobId } });
  }

  async getBackfillJobs(status = null, limit = 20) {
    const where = status ? { status } : {};
    return this.prisma.backfill_jobs.findMany({
      where, orderBy: { created_at: 'desc' }, take: limit,
    });
  }

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

  async updateBackfillJob(jobId, params) {
    return this.prisma.backfill_jobs.updateMany({
      where: { job_id: jobId },
      data: params,
    });
  }

  /** ── DATA AVAILABILITY UPDATE ── */
  async updateDataAvailability(params) {
    const { symbol, timeframe, firstDate, lastDate, recordCount } = params;
    const existing = await this.prisma.data_availability.findUnique({
      where: { symbol_timeframe: { symbol, timeframe } },
    });
    if (existing) {
      return this.prisma.data_availability.update({
        where: { symbol_timeframe: { symbol, timeframe } },
        data: {
          first_date: firstDate < existing.first_date ? new Date(firstDate) : undefined,
          last_date: lastDate > existing.last_date ? new Date(lastDate) : undefined,
          total_records: { increment: recordCount || 0 },
        },
      });
    }
    return this.prisma.data_availability.create({
      data: { symbol, timeframe, first_date: new Date(firstDate), last_date: new Date(lastDate), total_records: recordCount || 0 },
    });
  }

  async getSymbolsWithGaps(tradingDays = 5) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - tradingDays);
    return this.prisma.$queryRaw`
      SELECT symbol FROM data_availability
      WHERE last_date < ${cutoff.toISOString().split('T')[0]}
      ORDER BY symbol ASC
    `;
  }
}

module.exports = SystemRepository;
