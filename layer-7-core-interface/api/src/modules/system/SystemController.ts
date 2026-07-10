const BaseController = require('../../common/controllers/BaseController');

/**
 * @class SystemController
 * @extends BaseController
 * @description Controller for System Status and Administration.
 * Manages endpoints for system health checks, metric aggregation, and administrative commands like backfill.
 */
class SystemController extends BaseController {
  /**
   * @param {Object} dependencies - Dependency injection container
   * @param {SystemService} dependencies.systemService - Service for system logic
   */
  constructor({ systemService }) {
    super({ service: systemService });
    this.systemService = systemService;
  }

  /**
   * @method getSystemStatus
   * @description Aggregates status metrics from all layers (Ingestion, Processing, etc.) and infrastructure.
   * @param {FastifyRequest} req - The request object
   * @param {FastifyReply} reply - The reply object
   * @returns {Promise<void>} Sends JSON response with full system status tree
   */
  getSystemStatus = async (req, reply) => {
    try {
      const status = await this.systemService.getSystemStatus();
      return this.sendSuccess(reply, status);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * @method triggerBackfill
   * @description Triggers a historical data backfill operation via Redis Pub/Sub.
   * @param {FastifyRequest} req - The request object (containing backfill params in body)
   * @param {FastifyReply} reply - The reply object
   * @returns {Promise<void>} Sends success message with jobId
   */
  triggerBackfill = async (req, reply) => {
    try {
      const result = await this.systemService.triggerBackfill(req.body);
      return this.sendSuccess(reply, result);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * @method getSwarmStatus
   * @description Get Swarm Status from Redis
   * @route GET /api/v1/system/backfill/swarm/status
   */
  getSwarmStatus = async (req, reply) => {
    try {
      const status = await this.systemService.getSwarmStatus();
      return this.sendSuccess(reply, status);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
  /**
   * @method getDataStats
   * @description Get real-time data statistics from the database.
   * Currently returns the total count of rows in the `candles_1m` table.
   * This is used by the frontend to display the "DB Sync" progress.
   * 
   * @route GET /api/v1/data/stats
   * @returns {Object} { candles_1m: number }
   */
  getDataStats = async (req, reply) => {
    try {
      // Get candle count from repository via service
      const count = await this.systemService.systemRepository.getCandleCount();
      return this.sendSuccess(reply, { candles_1m: Number(count) });
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // DATA AVAILABILITY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * @method getDataAvailability
   * @description Returns data availability summary for all symbols or a specific symbol.
   * @route GET /api/v1/data/availability
   */
  getDataAvailability = async (req, reply) => {
    try {
      const symbol = req.query.symbol || null;
      const data = await this.systemService.getDataAvailability(symbol);
      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * @method getBackfillJobs
   * @description Returns list of backfill jobs.
   * @route GET /api/v1/backfill
   */
  getBackfillJobs = async (req, reply) => {
    try {
      const { status, limit = 20 } = req.query;
      const jobs = await this.systemService.getBackfillJobs(status, parseInt(limit));
      return this.sendSuccess(reply, { jobs });
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * @method getBackfillJob
   * @description Returns a single backfill job by ID.
   * @route GET /api/v1/backfill/:jobId
   */
  getBackfillJob = async (req, reply) => {
    try {
      const job = await this.systemService.getBackfillJob(req.params.jobId);
      return this.sendSuccess(reply, job);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // UPDATE ENDPOINTS (For Ingestion Layer HTTP Calls)
  // ═══════════════════════════════════════════════════════════════

  /**
   * @method updateDataAvailability
   * @description Updates data availability after ingestion.
   * @route PUT /api/v1/data/availability
   */
  updateDataAvailability = async (req, reply) => {
    try {
      const result = await this.systemService.updateDataAvailability(req.body);
      return this.sendSuccess(reply, result);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * @method updateBackfillJob
   * @description Updates backfill job status and progress.
   * @route PATCH /api/v1/backfill/:jobId
   */
  updateBackfillJob = async (req, reply) => {
    try {
      const result = await this.systemService.updateBackfillJob(req.params.jobId, req.body);
      return this.sendSuccess(reply, result);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  /**
   * @method getSymbolsWithGaps
   * @description Returns symbols that need backfilling.
   * @route GET /api/v1/data/gaps
   */
  getSymbolsWithGaps = async (req, reply) => {
    try {
      const tradingDays = parseInt(req.query.days) || 5;
      const symbols = await this.systemService.getSymbolsWithGaps(tradingDays);
      return this.sendSuccess(reply, { symbols });
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
}

module.exports = SystemController;
