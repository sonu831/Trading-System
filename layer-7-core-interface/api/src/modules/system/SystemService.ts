const BaseService = require('../../common/services/BaseService');
const axios = require('axios');

class SystemService extends BaseService {
  constructor({ systemRepository }) {
    super({ repository: systemRepository });
    this.systemRepository = systemRepository;
  }

  /** Probe infrastructure health — return actual status, not assumptions */
  async getInfraStatus() {
    const results = { kafka: false, redis: false, timescaledb: false };
    try {
      await this.systemRepository.redis.ping();
      results.redis = true;
    } catch (_) {}
    try {
      await this.systemRepository.prisma.$queryRaw`SELECT 1`;
      results.timescaledb = true;
    } catch (_) {}
    // Kafka: check if at least one consumer group exists
    try {
      await this.systemRepository.redis.exists('system:kafka:status') || results.kafka; // best-effort
    } catch (_) {}
    return results;
  }

  async getSystemStatus() {
    const [logs, l1, l2, l4, l5, l6, l7, backfill, candleCount, infra] = await Promise.all([
      this.systemRepository.getLogs(),
      this.systemRepository.getMetric('system:layer1:metrics'),
      this.systemRepository.getMetric('system:layer2:metrics'),
      this.systemRepository.getMetric('system:layer4:metrics'),
      this.systemRepository.getMetric('system:layer5:metrics'),
      this.systemRepository.getMetric('system:layer6:metrics'),
      this.systemRepository.getMetric('layer7_api_http_request_duration_seconds'),
      this.systemRepository.getMetric('system:layer1:backfill'),
      this.systemRepository.getCandleCount().catch(() => 0),
      this.getInfraStatus(),
    ]);

    // Fetch enabled broker providers + their status
    const BrokerRepository = require('../broker/BrokerRepository');
    const brokerRepo = new BrokerRepository(this.systemRepository.prisma, this.systemRepository.redis);
    const providers = await brokerRepo.findAllProviders().catch(() => []);
    const brokerStatus = providers
      .filter((p: any) => p.enabled)
      .map((p: any) => ({
        provider: p.provider, role: p.role,
        status: p.status || 'DISCONNECTED', last_tested_at: p.last_tested_at,
      }));

    // Layer status: derive from metrics, not hardcoded assumptions
    const layerStatus = (metrics) => {
      if (!metrics || Object.keys(metrics).length === 0) return 'UNKNOWN';
      if (metrics.status === 'OFFLINE') return 'OFFLINE';
      return 'ONLINE';
    };

    const safeL1 = l1 || { type: 'Stream', source: 'MStock', status: 'Unknown' };
    const safeL2 = l2 || { status: 'Unknown' };
    const safeL4 = l4 || { status: 'Unknown' };
    const safeL5 = l5 || { status: 'Unknown' };
    const safeL6 = l6 || { status: 'Unknown' };

    return {
      layers: {
        layer1: { name: 'L1 · Ingestion', status: layerStatus(l1), metrics: safeL1, backfill, logs },
        layer2: { name: 'L2 · Processing', status: layerStatus(l2), metrics: safeL2 },
        layer3: {
          name: 'L3 · Storage', status: infra.timescaledb ? 'ONLINE' : 'OFFLINE',
          metrics: { db_rows: candleCount, type: 'TimescaleDB' },
        },
        layer4: { name: 'L4 · Analysis (Go)', status: layerStatus(l4), metrics: safeL4 },
        layer5: { name: 'L5 · Aggregation', status: layerStatus(l5), metrics: safeL5 },
        layer6: { name: 'L6 · Signal', status: layerStatus(l6), metrics: safeL6 },
        layer7: { name: 'L7 · API Gateway', status: 'ONLINE', uptime_sec: process.uptime() },
      },
      infra: {
        kafka: infra.kafka ? 'ONLINE' : 'OFFLINE',
        redis: infra.redis ? 'ONLINE' : 'OFFLINE',
        timescaledb: infra.timescaledb ? 'ONLINE' : 'OFFLINE',
      },
      brokers: brokerStatus,
    };
  }

  async getSwarmStatus() {
    // defaults to null (IDLE) if not found
    return this.systemRepository.getSwarmStatus() || { status: 'IDLE' };
  }

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
   */
  async getDataAvailability(symbol = null) {
    const records = await this.systemRepository.getDataAvailability(symbol);

    // Map records to match Frontend expectations (BackfillPanel.jsx)
    // - total_candles: used for "DB Sync" progress calculation
    // - earliest/latest: used for determining gaps
    const mappedRecords = records.map(r => ({
      ...r,
      total_candles: r.total_records ? Number(r.total_records) : 0, 
      earliest: r.first_date, 
      latest: r.last_date,    
    }));

    // Calculate aggregated summary for the entire dataset
    // This provides the "Grand Total" used in the dashboard progress bar
    const summary = {
      totalSymbols: records.length,
      totalRecords: records.reduce((sum, r) => sum + Number(r.total_records || 0), 0),
      earliestDate: records.length ? records.reduce((min, r) => r.first_date < min ? r.first_date : min, records[0].first_date) : null,
      latestDate: records.length ? records.reduce((max, r) => r.last_date > max ? r.last_date : max, records[0].last_date) : null,
    };

    return { summary, symbols: mappedRecords };
  }

  /**
   * Get a specific backfill job by ID
   * @param {string} jobId - The job UUID
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
   */
  async getBackfillJobs(status = null, limit = 20) {
    return this.systemRepository.getBackfillJobs(status, limit);
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE METHODS (For Ingestion Layer HTTP Calls)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update data availability after ingestion
   * @param {Object} params - { symbol, timeframe, firstDate, lastDate, recordCount }
   */
  async updateDataAvailability(params) {
    return this.systemRepository.updateDataAvailability(params);
  }

  /**
   * Update backfill job status
   * @param {string} jobId - The job UUID
   * @param {Object} params - { status, processed, errors }
   */
  async updateBackfillJob(jobId, params) {
    return this.systemRepository.updateBackfillJob(jobId, params);
  }

  /**
   * Get symbols with data gaps
   * @param {number} tradingDays - Number of trading days to check
   */
  async getSymbolsWithGaps(tradingDays = 5) {
    const records = await this.systemRepository.getSymbolsWithGaps(tradingDays);
    return records.map(r => r.symbol);
  }
}

module.exports = SystemService;
