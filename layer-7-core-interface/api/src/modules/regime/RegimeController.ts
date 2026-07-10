const BaseController = require('../../common/controllers/BaseController');

/**
 * @class RegimeController
 * @description Serves the multi-timeframe market regime and market breadth.
 * These decide which trade tiers are permitted, so the dashboard leads with them.
 */
class RegimeController extends BaseController {
  constructor({ regimeService }) {
    super({ service: regimeService });
    this.regimeService = regimeService;
  }

  /** GET /api/v1/regime/latest */
  getLatestRegime = async (req, reply) => {
    try {
      const regime = await this.regimeService.getLatestRegime();
      // `null` is a legitimate answer: the regime engine has not published yet.
      return this.sendSuccess(reply, regime);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /** GET /api/v1/breadth/latest */
  getLatestBreadth = async (req, reply) => {
    try {
      const breadth = await this.regimeService.getLatestBreadth();
      return this.sendSuccess(reply, breadth);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
}

module.exports = RegimeController;
