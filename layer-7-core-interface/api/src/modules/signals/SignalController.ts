const BaseController = require('../../common/controllers/BaseController');

/**
 * @class SignalController
 * @extends BaseController
 * @description Controller for handling Trading Signals.
 * Manages HTTP requests for retrieving generated signals.
 */
class SignalController extends BaseController {
  /**
   * @param {Object} dependencies - Dependency injection container
   * @param {SignalService} dependencies.signalService - Service for signal business logic
   */
  constructor({ signalService }) {
    super({ service: signalService });
    this.signalService = signalService;
  }

  /**
   * @method getSignals
   * @description Retrieve the latest trading signals from the history list.
   * @param {FastifyRequest} req - The request object
   * @param {FastifyReply} reply - The reply object
   * @returns {Promise<void>} Sends JSON response with signals array
   */
  getSignals = async (req, reply) => {
    try {
      const signals = await this.signalService.getLatestSignals();
      return this.sendSuccess(reply, signals);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
}

module.exports = SignalController;
