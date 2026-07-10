const BaseService = require('../../common/services/BaseService');

/**
 * @class SignalService
 * @extends BaseService
 * @description Service for managing Signal business logic.
 * Handles retrieval and processing of trading signals from the repository.
 */
class SignalService extends BaseService {
  /**
   * @param {Object} dependencies - Dependency injection container
   * @param {SignalRepository} dependencies.signalRepository - Repository for signal data access
   */
  constructor({ signalRepository }) {
    super({ repository: signalRepository });
    this.signalRepository = signalRepository;
  }

  /**
   * @method getLatestSignals
   * @description Fetches the most recent signals from the persistence layer.
   * @returns {Promise<Array>} List of signal objects
   */
  async getLatestSignals() {
    // In future, filtering logic can go here (e.g. filter by active, type, etc.)
    // For now, simple pass-through to matching existing behavior
    const signals = await this.signalRepository.getRecentSignals();
    return signals || [];
  }
}

module.exports = SignalService;
