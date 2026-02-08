const { systemStatusSchema, backfillTriggerSchema } = require('./schemas');

/**
 * System Routes
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function systemRoutes(fastify, options) {
  const container = require('../../container');
  const systemController = container.resolve('systemController');

  // ─────────────────────────────────────────────────────────────
  // SYSTEM STATUS
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/system-status', {
    schema: systemStatusSchema,
    handler: systemController.getSystemStatus,
  });

  // ─────────────────────────────────────────────────────────────
  // BACKFILL MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  fastify.post('/api/v1/system/backfill/trigger', {
    schema: backfillTriggerSchema,
    handler: systemController.triggerBackfill,
  });

  fastify.get('/api/v1/system/backfill/swarm/status', {
    schema: {
      tags: ['Backfill'],
      description: 'Get swarm backfill status'
    },
    handler: systemController.getSwarmStatus,
  });

  fastify.get('/api/v1/backfill', {
    schema: {
      tags: ['Backfill'],
      description: 'Get all backfill jobs'
    },
    handler: systemController.getBackfillJobs,
  });

  fastify.get('/api/v1/backfill/:jobId', {
    schema: {
      tags: ['Backfill'],
      description: 'Get specific backfill job by ID'
    },
    handler: systemController.getBackfillJob,
  });

  fastify.patch('/api/v1/backfill/:jobId', {
    schema: {
      tags: ['Backfill'],
      description: 'Update backfill job status'
    },
    handler: systemController.updateBackfillJob,
  });

  // ─────────────────────────────────────────────────────────────
  // DATA AVAILABILITY (Used by Ingestion Layer)
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/data/availability', {
    schema: {
      tags: ['Data'],
      description: 'Get data availability for all symbols'
    },
    handler: systemController.getDataAvailability,
  });

  fastify.put('/api/v1/data/availability', {
    schema: {
      tags: ['Data'],
      description: 'Update data availability cache'
    },
    handler: systemController.updateDataAvailability,
  });

  fastify.get('/api/v1/data/stats', {
    schema: {
      tags: ['Data'],
      description: 'Get data statistics'
    },
    handler: systemController.getDataStats,
  });

  fastify.get('/api/v1/data/gaps', {
    schema: {
      tags: ['Data'],
      description: 'Get symbols with data gaps'
    },
    handler: systemController.getSymbolsWithGaps,
  });

  // ─────────────────────────────────────────────────────────────
  // JOBS (Cron & Manual)
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/jobs/datasync', {
    schema: {
      tags: ['Jobs'],
      description: 'Get Data Sync Cron Job Status'
    },
    handler: systemController.getDataSyncStatus,
  });

  fastify.post('/api/v1/jobs/datasync/trigger', {
    schema: {
      tags: ['Jobs'],
      description: 'Manually trigger Data Sync Job'
    },
    handler: systemController.triggerDataSync,
  });

  fastify.post('/api/v1/system/cache/clear', {
    schema: {
      tags: ['System'],
      description: 'Clear System API Caches'
    },
    handler: systemController.clearCache,
  });

  // ─────────────────────────────────────────────────────────────
  // HEALTH & NEWS
  // ─────────────────────────────────────────────────────────────
  const healthController = require('./health.controller');
  fastify.get('/api/v1/health/detailed', {
    schema: {
      tags: ['Health'],
      description: 'Get detailed system health status'
    },
    handler: healthController.getDetailedHealth
  });

  const newsController = require('./news.controller');
  fastify.get('/api/v1/news', {
    schema: {
      tags: ['News'],
      description: 'Get latest market news'
    },
    handler: newsController.getNews
  });
}

module.exports = systemRoutes;
