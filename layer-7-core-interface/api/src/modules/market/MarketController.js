const BaseController = require('../../common/controllers/BaseController');

/**
 * @class MarketController
 * @extends BaseController
 * @description Controller for Market Data Views.
 * Serves pre-computed market snapshots for the UI.
 */
class MarketController extends BaseController {
  /**
   * @param {Object} dependencies - Dependency injection container
   * @param {MarketService} dependencies.marketService - Service for market view logic
   */
  constructor({ marketService }) {
    super({ service: marketService });
    this.marketService = marketService;
  }

  /**
   * @method getMarketView
   * @description Retrieves the latest cached market view.
   * @param {FastifyRequest} req - The request object
   * @param {FastifyReply} reply - The reply object
   * @returns {Promise<void>} Sends JSON response with market view data
   */
  getMarketView = async (req, reply) => {
    try {
      const view = await this.marketService.getMarketView();
      return this.sendSuccess(reply, view);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
}

module.exports = MarketController;
