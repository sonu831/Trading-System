/**
 * Regime Routes — multi-timeframe market regime (L6) + breadth/sectors (L5).
 * @param {FastifyInstance} fastify
 */
async function regimeRoutes(fastify, options) {
  const container = require('../../container');
  const regimeController = container.resolve('regimeController');

  fastify.get('/api/v1/regime/latest', {
    schema: {
      description:
        'Latest multi-timeframe market regime (trend, volatility, phase, timeframe alignment, tradeable tiers). `data` is null when the regime engine has not published yet.',
      tags: ['Regime'],
    },
    handler: regimeController.getLatestRegime,
  });

  fastify.get('/api/v1/breadth/latest', {
    schema: {
      description: 'Latest market breadth and sector momentum (Nifty-50 constituents).',
      tags: ['Regime'],
    },
    handler: regimeController.getLatestBreadth,
  });
}

module.exports = regimeRoutes;
