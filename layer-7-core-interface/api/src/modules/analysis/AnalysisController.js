const BaseController = require('../../common/controllers/BaseController');

/**
 * @class AnalysisController
 * @extends BaseController
 * @description Controller for Technical Analysis API endpoints.
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
   * Fetch candles with indicators for a symbol
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
   * Get multi-timeframe analysis summary
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
}

module.exports = AnalysisController;
