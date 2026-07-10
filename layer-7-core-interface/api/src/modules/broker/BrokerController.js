const BaseController = require('../../common/controllers/BaseController');

class BrokerController extends BaseController {
  constructor({ brokerService }) {
    super({ service: brokerService });
    this.brokerService = brokerService;
  }

  listProviders = async (req, reply) => {
    try {
      const data = await this.brokerService.listProviders();
      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  getProvider = async (req, reply) => {
    try {
      const data = await this.brokerService.getProvider(parseInt(req.params.id));
      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 500);
    }
  };

  createProvider = async (req, reply) => {
    try {
      const { provider, role, priority, enabled } = req.body;
      if (!provider) {
        return this.sendError(reply, new Error('provider is required'), 400);
      }
      const data = await this.brokerService.createProvider({ provider, role, priority, enabled });
      return this.sendSuccess(reply, data, 'Provider created', 201);
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 500);
    }
  };

  updateProvider = async (req, reply) => {
    try {
      const data = await this.brokerService.updateProvider(parseInt(req.params.id), req.body);
      return this.sendSuccess(reply, data, 'Provider updated');
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 500);
    }
  };

  saveCredential = async (req, reply) => {
    try {
      const { field_name, field_value } = req.body;
      if (!field_name || !field_value) {
        return this.sendError(reply, new Error('field_name and field_value are required'), 400);
      }
      await this.brokerService.saveCredential(parseInt(req.params.id), field_name, field_value);
      return this.sendSuccess(reply, null, 'Credential saved', 201);
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 500);
    }
  };

  enableProvider = async (req, reply) => {
    try {
      const data = await this.brokerService.enableProvider(parseInt(req.params.id));
      return this.sendSuccess(reply, data, `${data.provider} enabled`);
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 500);
    }
  };

  disableProvider = async (req, reply) => {
    try {
      const data = await this.brokerService.disableProvider(parseInt(req.params.id));
      return this.sendSuccess(reply, data, `${data.provider} disabled`);
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 500);
    }
  };

  getProviderStatus = async (req, reply) => {
    try {
      const data = await this.brokerService.getProviderStatus(req.params.provider);
      return this.sendSuccess(reply, data);
    } catch (err) {
      return this.sendError(reply, err);
    }
  };

  deleteProvider = async (req, reply) => {
    try {
      await this.brokerService.deleteProvider(parseInt(req.params.id));
      return this.sendSuccess(reply, null, 'Provider deleted');
    } catch (err) {
      return this.sendError(reply, err, err.statusCode || 500);
    }
  };
}

module.exports = BrokerController;
