/**
 * Base Vendor Integration Interface
 * All vendor implementations must extend this class
 */
const { MarketHours } = require('../utils/market-hours');
const { HistoricalChunker } = require('../utils/historical-chunker');
const { ResponseBuilder } = require('../utils/response-builder');
const { RequestUtils } = require('../utils/request-utils');
const { DateTime } = require('luxon');
const { logger } = require('../utils/logger');

class BaseVendor {
  constructor(options) {
    this.name = 'BaseVendor';
    this.options = options;
    this.onTick = options.onTick;
    this.marketHours = new MarketHours();
  }

  // ... (Connect/Disconnect/Subscribe methods abstract - same as before) ...
  async connect() {
    throw new Error('Method connect() must be implemented');
  }
  async disconnect() {
    throw new Error('Method disconnect() must be implemented');
  }
  /**
   * Subscribe to list of symbols
   * @param {Array<string>} symbols
   */
  subscribe(symbols) {
    throw new Error('Method subscribe() must be implemented');
  }
  isConnected() {
    return false;
  }

  /**
   * Fetch Unified Data (Intelligent Routing)
   */
  async fetchData(params) {
    // 1. Normalize Inputs
    const normParams = RequestUtils.normalizeHistoricalParams(params);

    // 2. Decision Logic: Historical vs Real-Time
    const marketStatus = this.marketHours.getMarketStatus();

    // Explicit Date Range = Historical
    if ((params.fromDate || params.fromdate) && (params.toDate || params.todate)) {
      logger.info(
        `BaseVendor: Fetching Historical Data (${normParams.fromdate} to ${normParams.todate})`
      );
      return await this._getChunkedHistoricalData(normParams);
    }

    // Market Open = Real-time
    if (marketStatus.isOpen) {
      logger.info('BaseVendor: Market Open - Requesting Real-time (Intraday) Data');
      if (this.getIntradayChartData) {
        return await this.getIntradayChartData(normParams);
      } else {
        logger.warn(
          `${this.name} does not support getIntradayChartData, falling back to recent history.`
        );
        const today = DateTime.now().toISODate();
        return await this._getChunkedHistoricalData({
          ...normParams,
          fromdate: today,
          todate: today,
        });
      }
    } else {
      // Market Closed = Recent History
      logger.info('BaseVendor: Market Closed - Fetching recent Historical Data');
      const end = DateTime.now();
      const start = end.minus({ days: 3 });
      return await this._getChunkedHistoricalData({
        ...normParams,
        fromdate: start.toISODate(),
        todate: end.toISODate(),
      });
    }
  }

  /**
   * Helper: Handle API Limitations via Chunking
   * @private
   */
  async _getChunkedHistoricalData(params) {
    // Validate
    try {
      RequestUtils.validateHistoricalParams(params);
    } catch (e) {
      return ResponseBuilder.error(e.message, 'IA400');
    }

    // Split Range
    const chunks = HistoricalChunker.splitRange({
      fromDate: params.fromdate,
      toDate: params.todate,
      interval: params.interval,
    });

    if (chunks.length === 0) {
      return ResponseBuilder.error('Invalid Date Range', 'IA400');
    }

    if (chunks.length <= 1) {
      return await this.getHistoricalData(params);
    }

    logger.info(`BaseVendor: Splitting request into ${chunks.length} chunks.`);

    let combinedCandles = [];

    for (const chunk of chunks) {
      const chunkParams = {
        ...params,
        fromdate: chunk.fromDate,
        todate: chunk.toDate,
      };

      try {
        const response = await this.getHistoricalData(chunkParams);

        if (response && response.status && Array.isArray(response.data?.candles)) {
          combinedCandles = [...combinedCandles, ...response.data.candles];
        } else if (response && response.status === true && response.data === null) {
          // Empty chunk ok
        } else {
          logger.warn(`BaseVendor: Chunk failed for ${chunkParams.fromdate}`);
        }
      } catch (e) {
        logger.error(`BaseVendor: Chunk Error: ${e.message}`);
        // finalStatus was unused, removing
      }
    }

    // Return standardized response
    return ResponseBuilder.historical(combinedCandles);
  }

  async getHistoricalData(_params) {
    throw new Error('getHistoricalData must be implemented');
  }
  async getIntradayChartData(_params) {
    throw new Error('getIntradayChartData must be implemented (optional)');
  }
}

module.exports = { BaseVendor };
