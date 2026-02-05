/**
 * Analysis Routes
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function analysisRoutes(fastify, options) {
  const container = require('../../container');
  const analysisController = container.resolve('analysisController');

  // GET /api/market/candles - Fetch candles with indicators
  fastify.get('/api/market/candles', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol (e.g., RELIANCE)' },
          interval: {
            type: 'string',
            enum: ['1m', '5m', '10m', '15m', '30m', '1h', '4h', '1d', '1w'],
            default: '15m',
            description: 'Candle timeframe',
          },
          limit: { type: 'integer', default: 500, maximum: 1000 },
        },
        required: ['symbol'],
      },
      tags: ['Analysis'],
      summary: 'Get candlestick data with technical indicators',
    },
    handler: analysisController.getCandles,
  });

  // GET /api/market/overview/:symbol - Stock overview
  fastify.get('/api/market/overview/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
        },
        required: ['symbol'],
      },
      tags: ['Analysis'],
      summary: 'Get stock overview with price and signal',
    },
    handler: analysisController.getOverview,
  });

  // GET /api/market/multi-tf/:symbol - Multi-timeframe summary
  fastify.get('/api/market/multi-tf/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
        },
        required: ['symbol'],
      },
      tags: ['Analysis'],
      summary: 'Get multi-timeframe analysis summary',
    },
    handler: analysisController.getMultiTimeframe,
  });

  // GET /api/v1/analyze/market - AI Market Sentiment
  fastify.get('/api/v1/analyze/market', {
    schema: {
      tags: ['Analysis'],
      summary: 'Get AI Market Sentiment and Smart Picks',
    },
    handler: analysisController.getMarketSentiment,
  });
}

module.exports = analysisRoutes;
