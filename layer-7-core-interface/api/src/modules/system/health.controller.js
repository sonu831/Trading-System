const process = require('process');

const getDetailedHealth = async (request, reply) => {
  const { container } = request.server;
  const redis = container.resolve('redis');
  const prisma = container.resolve('prisma');

  // 1. Check Redis
  let redisStatus = 'DOWN';
  try {
    // Redis client is a wrapper, so we access the internal publisher client
    const ping = await redis.publisher.ping();
    if (ping === 'PONG') redisStatus = 'UP';
  } catch (e) {
    request.log.error(e, 'Redis Health Check Failed');
  }

  // 2. Check Database (TimescaleDB via Prisma)
  let dbStatus = 'DOWN';
  try {
    // Simple query to validate connection
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'UP';
  } catch (e) {
    request.log.error(e, 'DB Health Check Failed');
  }

  // 3. Check Kafka (Placeholder)
  // kafka: 'UNKNOWN'

  // 4. Check Ingestion Service (via Redis Key)
  let ingestionStatus = 'DOWN';
  let ingestionMetrics = null;
  try {
    const rawMetrics = await redis.get('system:layer1:metrics');
    if (rawMetrics) {
      ingestionMetrics = JSON.parse(rawMetrics);
      // Check staleness (if timestamp is older than 60s, it's stalled)
      const diff = Date.now() - (ingestionMetrics.timestamp || 0);
      ingestionStatus = diff < 60000 ? 'UP' : 'STALE';
    }
  } catch (e) {
    request.log.error(e, 'Ingestion Check Failed');
  }

  const status = {
    service: 'layer-7-api',
    uptime: process.uptime(),
    timestamp: new Date(),
    components: {
      redis: redisStatus,
      database: dbStatus,
      ingestion: ingestionStatus,
      ingestion_details: ingestionMetrics, // Pass details for Live Status
    },
    overall: redisStatus === 'UP' && dbStatus === 'UP' ? 'HEALTHY' : 'DEGRADED',
  };

  return status;
};

module.exports = {
  getDetailedHealth,
};
