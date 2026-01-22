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
   * @returns {Promise<void>} Sends success message
   */
  triggerBackfill = async (req, reply) => {
    try {
      const result = await this.systemService.triggerBackfill(req.body);
      return this.sendSuccess(reply, result);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };
}

module.exports = SystemController;
