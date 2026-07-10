const BaseController = require('../../common/controllers/BaseController');

/**
 * @class AnalysisController
 * @extends BaseController
 * @description High-performance controller for Technical Analysis API endpoints.
 * Supports full indicator suite, backtesting, and AI predictions.
 */
class AnalysisController extends BaseController {
  /**
   * @param {Object} dependencies
   * @param {AnalysisService} dependencies.analysisService
   */
  constructor({ analysisService }) {
    super({ service: analysisService });
    this.analysisService = analysisService;
  }

  /**
   * GET /api/market/candles
   * Fetch candles with indicators for a symbol (legacy endpoint)
   */
  getCandles = async (req, reply) => {
    try {
      const { symbol, interval = '15m', limit = 500 } = req.query;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const validIntervals = ['1m', '5m', '10m', '15m', '30m', '1h', '4h', '1d', '1w'];
      if (!validIntervals.includes(interval)) {
        return this.sendError(
          reply,
          { message: `Invalid interval. Valid: ${validIntervals.join(', ')}` },
          400
        );
      }

      const data = await this.analysisService.getCandlesWithIndicators(
        symbol.toUpperCase(),
        interval,
        parseInt(limit, 10)
      );

      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/market/overview/:symbol
   * Get stock overview with price, change, signal
   */
  getOverview = async (req, reply) => {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const data = await this.analysisService.getStockOverview(symbol.toUpperCase());

      if (!data) {
        return this.sendError(reply, { message: 'Symbol not found' }, 404);
      }

      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/market/multi-tf/:symbol
   * Get multi-timeframe analysis summary (legacy endpoint)
   */
  getMultiTimeframe = async (req, reply) => {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const data = await this.analysisService.getMultiTimeframeSummary(symbol.toUpperCase());

      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/v1/analyze/market
   * Get AI Market Sentiment (Proxy to Go Service)
   */
  getMarketSentiment = async (req, reply) => {
    try {
      const data = await this.analysisService.getMarketSentiment();
      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  // ============================================================
  // NEW ENHANCED ENDPOINTS
  // ============================================================

  /**
   * GET /api/market/analysis/:symbol
   * Full analysis endpoint - combines all data with 11+ indicators
   * High performance: parallel fetching
   */
  getFullAnalysis = async (req, reply) => {
    try {
      const { symbol } = req.params;
      const { interval = '15m', limit = 500 } = req.query;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const upperSymbol = symbol.toUpperCase();

      // Fetch all data in parallel for maximum performance
      const [candlesWithIndicators, overview, enhancedMultiTF, optionsAnalysis] = await Promise.all([
        this.analysisService.getCandlesWithFullIndicators(upperSymbol, interval, parseInt(limit, 10)),
        this.analysisService.getStockOverview(upperSymbol),
        this.analysisService.getEnhancedMultiTimeframeSummary(upperSymbol),
        this.analysisService.getOptionsAnalysis(upperSymbol),
      ]);

      return this.sendSuccess(reply, {
        symbol: upperSymbol,
        interval,
        ...candlesWithIndicators,
        overview,
        multiTimeframe: enhancedMultiTF,
        options: optionsAnalysis,
      });
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/market/backtest/:symbol
   * Historical pattern backtest
   * Processes up to 2500 daily candles (10 years)
   */
  getBacktest = async (req, reply) => {
    try {
      const { symbol } = req.params;
      const { indicator, operator, threshold } = req.query;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      if (!indicator || !operator || threshold === undefined) {
        return this.sendError(
          reply,
          { message: 'Missing required params: indicator, operator, threshold' },
          400
        );
      }

      const validIndicators = ['rsi', 'macd_hist', 'stochastic_k', 'bb_position'];
      if (!validIndicators.includes(indicator)) {
        return this.sendError(
          reply,
          { message: `Invalid indicator. Valid: ${validIndicators.join(', ')}` },
          400
        );
      }

      const validOperators = ['lt', 'gt', 'lte', 'gte'];
      if (!validOperators.includes(operator)) {
        return this.sendError(
          reply,
          { message: `Invalid operator. Valid: ${validOperators.join(', ')}` },
          400
        );
      }

      const results = await this.analysisService.runBacktest(
        symbol.toUpperCase(),
        indicator,
        operator,
        parseFloat(threshold)
      );

      return this.sendSuccess(reply, results);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/market/ai-predict/:symbol
   * AI prediction from Layer 9
   */
  getAIPrediction = async (req, reply) => {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const prediction = await this.analysisService.getAIPrediction(symbol.toUpperCase());

      return this.sendSuccess(reply, prediction);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/market/enhanced-multi-tf/:symbol
   * Enhanced multi-timeframe summary with 7-factor verdicts
   */
  getEnhancedMultiTimeframe = async (req, reply) => {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const data = await this.analysisService.getEnhancedMultiTimeframeSummary(symbol.toUpperCase());

      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/market/options/:symbol
   * Options analysis (PCR, Max Pain)
   */
  getOptionsAnalysis = async (req, reply) => {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const data = await this.analysisService.getOptionsAnalysis(symbol.toUpperCase());

      if (!data) {
        return this.sendSuccess(reply, { message: 'No options data available', data: null });
      }

      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  // ============================================================
  // AI SERVICE METHODS
  // ============================================================

  /**
   * GET /api/ai/features/:symbol
   * Get multi-timeframe indicators for AI prediction models
   */
  getAIFeatures = async (req, reply) => {
    try {
      const { symbol } = req.params;
      const timeframes = (req.query.timeframes || '5m,15m,1h,4h,1d').split(',');

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const features = {};
      for (const tf of timeframes) {
        const trimmedTf = tf.trim();
        features[trimmedTf] = await this.analysisService.getIndicatorsOnly(
          symbol.toUpperCase(),
          trimmedTf
        );
      }

      return reply.send({
        success: true,
        symbol: symbol.toUpperCase(),
        timestamp: new Date().toISOString(),
        timeframesRequested: timeframes,
        features,
      });
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * POST /api/ai/query
   * Execute dynamic aggregation query for AI (fallback)
   */
  executeAIQuery = async (req, reply) => {
    try {
      const { symbol, interval = '15m', aggregation = 'avg', field = 'close', lookback = 100, groupBy } = req.body;

      if (!symbol) {
        return this.sendError(reply, { message: 'Symbol is required' }, 400);
      }

      const result = await this.analysisService.executeDynamicQuery({
        symbol: symbol.toUpperCase(),
        interval,
        aggregation,
        field,
        lookback,
        groupBy,
      });

      return reply.send({
        success: true,
        query: { symbol, interval, aggregation, field, lookback, groupBy },
        result,
      });
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * GET /api/ai/symbols
   * List all available symbols for AI processing
   */
  getAvailableSymbols = async (req, reply) => {
    try {
      const symbols = await this.analysisService.getAllSymbols();
      return reply.send({
        success: true,
        count: symbols.length,
        symbols,
      });
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
}

module.exports = AnalysisController;
