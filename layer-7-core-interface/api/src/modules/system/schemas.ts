/**
 * System Schema Definitions for Swagger
 */

const metricSchema = {
  type: 'object',
  additionalProperties: true, // Metrics are dynamic
};

const layerSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    status: { type: 'string', enum: ['ONLINE', 'OFFLINE', 'UNKNOWN'] },
    metrics: metricSchema,
  },
};

const systemStatusSchema = {
  description: 'Get full system status',
  tags: ['System'],
  summary: 'Get health and metrics of all layers',
  response: {
    200: {
      description: 'System Status Tree',
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            layers: {
              type: 'object',
              additionalProperties: layerSchema,
            },
            infra: {
              type: 'object',
              properties: {
                kafka: { type: 'string' },
                redis: { type: 'string' },
                timescaledb: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

const backfillTriggerSchema = {
  description: 'Trigger a backfill job — set symbol=null for bulk (all symbols)',
  tags: ['System'],
  summary: 'Start Backfill',
  body: {
    type: 'object',
    required: ['fromDate', 'toDate'],
    properties: {
      symbol: { type: ['string', 'null'], example: 'RELIANCE', description: 'Symbol or null for bulk backfill' },
      fromDate: { type: 'string', example: '2026-01-01' },
      toDate: { type: 'string', example: '2026-01-07' },
      days: { type: 'number', default: 30 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
};

module.exports = {
  systemStatusSchema,
  backfillTriggerSchema,
};
