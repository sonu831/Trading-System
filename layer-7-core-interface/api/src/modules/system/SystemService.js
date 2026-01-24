const BaseService = require('../../common/services/BaseService');

class SystemService extends BaseService {
  constructor({ systemRepository }) {
    super({ repository: systemRepository });
    this.systemRepository = systemRepository;
  }

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

  async triggerBackfill(payload) {
    await this.systemRepository.triggerBackfill(payload);
    return { message: 'Backfill triggered successfully' };
  }
}

module.exports = SystemService;
