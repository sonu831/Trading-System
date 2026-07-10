const BaseService = require('../../common/services/BaseService');

/**
 * @class MarketService
 * @extends BaseService
 * @description Service for accessing Market View Data.
 * Retrieval of high-level market summaries (Nifty 50 tokens, etc).
 */
class MarketService extends BaseService {
  /**
   * @param {Object} dependencies - Dependency injection container
   * @param {MarketRepository} dependencies.marketRepository - Repository for market data
   */
  constructor({ marketRepository }) {
    super({ repository: marketRepository });
    this.marketRepository = marketRepository;
  }

  /**
   * @method getMarketView
   * @description Fetches the latest 'market_view:latest' from cache.
   * @returns {Promise<Object>} Market view object or status message
   */
  async getMarketView() {
    const view = await this.marketRepository.getLatestMarketView();
    if (!view) {
      return { message: 'No market view available yet', status: 'WAITING' };
    }
    return view;
  }
}

module.exports = MarketService;
