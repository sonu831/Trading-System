const BaseController = require('../../common/controllers/BaseController');

/**
 * @class ExecutionController
 * @extends BaseController
 * @description Proxy controller for the Layer 10 execution engine
 * (positions, risk state, trade mode, kill switch).
 */
class ExecutionController extends BaseController {
  constructor({ executionService }) {
    super({ service: executionService });
    this.executionService = executionService;
  }

  /** GET /api/v1/execution/state */
  getState = async (req, reply) => {
    try {
      const state = await this.executionService.getState();
      return this.sendSuccess(reply, state);
    } catch (err) {
      // 503 => the dashboard shows "ENGINE OFFLINE" rather than pretending all is well.
      return this.sendError(reply, err, err.statusCode || 503);
    }
  };

  /** POST /api/v1/execution/kill — halt new entries AND flatten the book. */
  kill = async (req, reply) => {
    try {
      const result = await this.executionService.kill();
      req.log?.warn({ result }, 'Kill switch ACTIVATED via API');
      return this.sendSuccess(reply, result, 'Trading halted');
    } catch (err) {
      req.log?.error({ err }, 'Kill switch activation FAILED');
      return this.sendError(reply, err, err.statusCode || 503);
    }
  };

  /** POST /api/v1/execution/resume */
  resume = async (req, reply) => {
    try {
      const result = await this.executionService.resume();
      req.log?.warn({ result }, 'Trading RESUMED via API');
      return this.sendSuccess(reply, result, 'Trading resumed');
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 503);
    }
  };

  /** POST /api/v1/execution/square-off */
  squareOff = async (req, reply) => {
    try {
      const result = await this.executionService.squareOff();
      req.log?.warn({ result }, 'Manual square-off requested via API');
      return this.sendSuccess(reply, result, 'Positions squared off');
    } catch (err) {
      req.log?.error({ err }, 'Square-off FAILED');
      return this.sendError(reply, err, err.statusCode || 503);
    }
  };

  /** GET /api/v1/execution/orders — order book from L10 journal */
  getOrders = async (req, reply) => {
    try {
      const orders = await this.executionService.getOrders();
      return this.sendSuccess(reply, orders);
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 503);
    }
  };
}

module.exports = ExecutionController;
