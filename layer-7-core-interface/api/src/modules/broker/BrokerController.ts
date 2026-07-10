const BaseController = require('../../common/controllers/BaseController');

class BrokerController extends BaseController {
  brokerService: any;
  constructor({ brokerService }: { brokerService: any }) { super(); this.brokerService = brokerService; }

  listProviders = async (req: any, reply: any) => { try { return this.sendSuccess(reply, await this.brokerService.listProviders()); } catch (e) { return this.sendError(reply, e); } };
  getProvider = async (req: any, reply: any) => { try { return this.sendSuccess(reply, await this.brokerService.getProvider(parseInt(req.params.id))); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  createProvider = async (req: any, reply: any) => { try { if (!req.body.provider) return this.sendError(reply, new Error('provider is required'), 400); return this.sendSuccess(reply, await this.brokerService.createProvider(req.body), 'Provider created', 201); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  updateProvider = async (req: any, reply: any) => { try { return this.sendSuccess(reply, await this.brokerService.updateProvider(parseInt(req.params.id), req.body), 'Provider updated'); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  saveCredential = async (req: any, reply: any) => { try { if (!req.body.field_name || !req.body.field_value) return this.sendError(reply, new Error('field_name and field_value required'), 400); await this.brokerService.saveCredential(parseInt(req.params.id), req.body.field_name, req.body.field_value); return this.sendSuccess(reply, null, 'Credential saved', 201); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  enableProvider = async (req: any, reply: any) => { try { const d = await this.brokerService.enableProvider(parseInt(req.params.id)); return this.sendSuccess(reply, d, `${d.provider} enabled`); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  disableProvider = async (req: any, reply: any) => { try { const d = await this.brokerService.disableProvider(parseInt(req.params.id)); return this.sendSuccess(reply, d, `${d.provider} disabled`); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  getProviderStatus = async (req: any, reply: any) => { try { return this.sendSuccess(reply, await this.brokerService.getProviderStatus(req.params.provider)); } catch (e) { return this.sendError(reply, e); } };
  deleteProvider = async (req: any, reply: any) => { try { await this.brokerService.deleteProvider(parseInt(req.params.id)); return this.sendSuccess(reply, null, 'Provider deleted'); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  deleteCredential = async (req: any, reply: any) => { try { if (!req.query.field_name) return this.sendError(reply, new Error('field_name query param required'), 400); await this.brokerService.deleteCredential(parseInt(req.params.id), req.query.field_name); return this.sendSuccess(reply, null, 'Credential deleted'); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
  saveCredentials = async (req: any, reply: any) => { try { if (!req.body || !req.body.credentials || !Array.isArray(req.body.credentials)) return this.sendError(reply, new Error('credentials array required'), 400); await this.brokerService.saveCredentials(parseInt(req.params.id), req.body.credentials as Array<{ field_name: string; field_value: string }>); return this.sendSuccess(reply, null, 'Credentials saved', 201); } catch (e: any) { return this.sendError(reply, e, e.statusCode || 500); } };
}

module.exports = BrokerController;
