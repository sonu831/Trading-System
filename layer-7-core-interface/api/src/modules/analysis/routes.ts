/**
 * Analysis Routes
 * High-performance endpoints for technical analysis, backtesting, and AI predictions
 *
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function analysisRoutes(fastify, options) {
  const container = require('../../container');
  const analysisController = container.resolve('analysisController');

  // ============================================================
  // LEGACY ENDPOINTS (backward compatibility)
  // ============================================================

  // GET /api/market/candles - Fetch candles with basic indicators
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
      summary: 'Get candlestick data with technical indicators (legacy)',
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

  // GET /api/market/multi-tf/:symbol - Multi-timeframe summary (legacy)
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
      summary: 'Get multi-timeframe analysis summary (legacy)',
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

  // ============================================================
  // NEW ENHANCED ENDPOINTS
  // ============================================================

  // GET /api/market/analysis/:symbol - FULL analysis (combined endpoint)
  fastify.get('/api/market/analysis/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol (e.g., RELIANCE)' },
        },
        required: ['symbol'],
      },
      querystring: {
        type: 'object',
        properties: {
          interval: {
            type: 'string',
            enum: ['1m', '5m', '10m', '15m', '30m', '1h', '4h', '1d', '1w'],
            default: '15m',
            description: 'Primary timeframe for candle data',
          },
          limit: { type: 'integer', default: 500, maximum: 1000 },
        },
      },
      tags: ['Analysis'],
      summary: 'Full analysis with 11+ indicators, patterns, multi-TF verdicts, and options',
      description: `
        High-performance combined endpoint returning:
        - Candlestick data with 11+ technical indicators
        - Detected candlestick patterns
        - 7-factor verdict scoring
        - 6-timeframe analysis (5m, 15m, 1h, 4h, 1d, 1w)
        - Options PCR analysis (if available)
        - Stock overview
      `,
    },
    handler: analysisController.getFullAnalysis,
  });

  // GET /api/market/backtest/:symbol - Historical backtesting
  fastify.get('/api/market/backtest/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol' },
        },
        required: ['symbol'],
      },
      querystring: {
        type: 'object',
        properties: {
          indicator: {
            type: 'string',
            enum: ['rsi', 'macd_hist', 'stochastic_k', 'bb_position'],
            description: 'Indicator to test',
          },
          operator: {
            type: 'string',
            enum: ['lt', 'gt', 'lte', 'gte'],
            description: 'Comparison operator (lt=less than, gt=greater than)',
          },
          threshold: {
            type: 'number',
            description: 'Threshold value for the condition',
          },
        },
        required: ['indicator', 'operator', 'threshold'],
      },
      tags: ['Backtest'],
      summary: 'Run historical backtest for indicator conditions',
      description: `
        Tests historical performance of indicator-based signals.
        Example: ?indicator=rsi&operator=lt&threshold=30
        Returns 5/10/20 day forward returns with statistics.
        Processes up to 2500 daily candles (10 years of data).
      `,
    },
    handler: analysisController.getBacktest,
  });

  // GET /api/market/ai-predict/:symbol - AI Prediction
  fastify.get('/api/market/ai-predict/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol' },
        },
        required: ['symbol'],
      },
      tags: ['AI'],
      summary: 'Get AI prediction from Layer 9',
      description: `
        Returns AI-powered prediction with:
        - Prediction score (0-1, where >0.5 is bullish)
        - Confidence level
        - AI reasoning text
        - Model version
      `,
    },
    handler: analysisController.getAIPrediction,
  });

  // GET /api/market/enhanced-multi-tf/:symbol - Enhanced Multi-TF
  fastify.get('/api/market/enhanced-multi-tf/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol' },
        },
        required: ['symbol'],
      },
      tags: ['Analysis'],
      summary: 'Enhanced multi-timeframe analysis with 7-factor verdicts',
      description: `
        Returns analysis for 6 timeframes (5m, 15m, 1h, 4h, 1d, 1w) with:
        - RSI, MACD histogram
        - Supertrend direction
        - 7-factor verdict (signal + confidence)
        - Trend state
      `,
    },
    handler: analysisController.getEnhancedMultiTimeframe,
  });

  // GET /api/market/options/:symbol - Options Analysis
  fastify.get('/api/market/options/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol' },
        },
        required: ['symbol'],
      },
      tags: ['Options'],
      summary: 'Options analysis with PCR and Max Pain',
      description: `
        Returns options analysis including:
        - Put-Call Ratio (OI and Volume)
        - Total Put/Call OI and Volume
        - Max Pain strike price
        - Sentiment interpretation
      `,
    },
    handler: analysisController.getOptionsAnalysis,
  });

  // ============================================================
  // AI SERVICE ENDPOINTS (Layer 9 consumption)
  // ============================================================

  // GET /api/ai/features/:symbol - Multi-TF features for AI prediction
  fastify.get('/api/ai/features/:symbol', {
    schema: {
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol (e.g., RELIANCE)' },
        },
        required: ['symbol'],
      },
      querystring: {
        type: 'object',
        properties: {
          timeframes: {
            type: 'string',
            default: '5m,15m,1h,4h,1d',
            description: 'Comma-separated timeframes',
          },
          indicators: {
            type: 'string',
            default: 'all',
            description: 'Comma-separated indicators or "all"',
          },
        },
      },
      tags: ['AI'],
      summary: 'Get multi-timeframe indicators for AI prediction',
      description: `
        Returns comprehensive feature vectors across multiple timeframes for AI consumption.
        Includes: RSI, MACD, EMA, Bollinger Bands, ATR, Stochastic, ADX, Volume ratios.
        Each timeframe contains latest values and trend direction.
      `,
    },
    handler: analysisController.getAIFeatures,
  });

  // POST /api/ai/query - Dynamic query endpoint for AI
  fastify.post('/api/ai/query', {
    schema: {
      body: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol' },
          interval: { type: 'string', description: 'Timeframe interval' },
          aggregation: {
            type: 'string',
            enum: ['avg', 'sum', 'min', 'max', 'count', 'stddev'],
            description: 'Aggregation function',
          },
          field: {
            type: 'string',
            enum: ['open', 'high', 'low', 'close', 'volume'],
            description: 'Field to aggregate',
          },
          lookback: { type: 'integer', default: 100, description: 'Number of candles' },
          groupBy: { type: 'string', enum: ['hour', 'day', 'week'], description: 'Optional grouping' },
        },
        required: ['symbol'],
      },
      tags: ['AI'],
      summary: 'Execute dynamic aggregation query',
      description: `
        Fallback endpoint for AI to run custom aggregations.
        Supports avg, sum, min, max, count, stddev on OHLCV fields.
        Safe parameterized queries only - no raw SQL.
      `,
    },
    handler: analysisController.executeAIQuery,
  });

  // GET /api/ai/symbols - List all available symbols
  fastify.get('/api/ai/symbols', {
    schema: {
      tags: ['AI'],
      summary: 'Get list of all available symbols',
    },
    handler: analysisController.getAvailableSymbols,
  });
}

module.exports = analysisRoutes;
