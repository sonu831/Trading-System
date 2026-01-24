const BaseController = require('../../common/controllers/BaseController');

class AnalysisController extends BaseController {
  constructor({ analysisService }) {
    super({ service: analysisService });
    this.analysisService = analysisService;
  }

  getAnalysis = async (req, reply) => {
    try {
      const { symbol } = req.query;
      if (!symbol) return this.sendError(reply, new Error('Symbol required'));

      const data = await this.analysisService.getAnalysis(symbol);
      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  getMarketAnalysis = async (req, reply) => {
    try {
      const data = await this.analysisService.getMarketAnalysis();
      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
}

module.exports = AnalysisController;
