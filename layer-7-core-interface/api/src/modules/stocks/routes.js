/**
 * Stocks Routes - API endpoints for Nifty50 stock data
 * @param {FastifyInstance} fastify
 */
async function stocksRoutes(fastify, options) {
  const container = require('../../container');
  const stocksController = container.resolve('stocksController');

  // GET /api/v1/stocks/symbols - All symbols
  fastify.get('/api/v1/stocks/symbols', {
    schema: {
      description: 'Get all Nifty50 symbols',
      tags: ['stocks'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'number' },
            symbols: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    handler: stocksController.getSymbols,
  });

  // GET /api/v1/stocks - Full stock list
  fastify.get('/api/v1/stocks', {
    schema: {
      description: 'Get all Nifty50 stocks with metadata',
      tags: ['stocks'],
    },
    handler: stocksController.getAllStocks,
  });

  // GET /api/v1/stocks/sectors - All sectors
  fastify.get('/api/v1/stocks/sectors', {
    schema: {
      description: 'Get all unique sectors',
      tags: ['stocks'],
    },
    handler: stocksController.getSectors,
  });

  // GET /api/v1/stocks/by-sector - Grouped by sector
  fastify.get('/api/v1/stocks/by-sector', {
    schema: {
      description: 'Get stocks grouped by sector',
      tags: ['stocks'],
    },
    handler: stocksController.getStocksBySector,
  });

  // GET /api/v1/stocks/sector-map - Symbol -> Sector mapping
  fastify.get('/api/v1/stocks/sector-map', {
    schema: {
      description: 'Get sector mapping { symbol: sector }',
      tags: ['stocks'],
    },
    handler: stocksController.getSectorMap,
  });

  // GET /api/v1/stocks/:symbol - Single stock
  fastify.get('/api/v1/stocks/:symbol', {
    schema: {
      description: 'Get stock details by symbol',
      tags: ['stocks'],
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
        },
        required: ['symbol'],
      },
    },
    handler: stocksController.getStock,
  });
}

module.exports = stocksRoutes;
