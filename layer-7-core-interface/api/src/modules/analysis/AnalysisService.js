const BaseService = require('../../common/services/BaseService');

class AnalysisService extends BaseService {
  constructor({ redis }) {
    super({ redis });
    this.analysisUrl = process.env.ANALYSIS_API_URL || 'http://analysis:8081';
  }

  async getAnalysis(symbol) {
    const url = `${this.analysisUrl}/analyze?symbol=${symbol}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Analysis service error: ${response.statusText}`);
    }
    return await response.json();
  }

  async getMarketAnalysis() {
    const url = `${this.analysisUrl}/analyze/market`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Analysis service error: ${response.statusText}`);
    }
    return await response.json();
  }
}

module.exports = AnalysisService;
