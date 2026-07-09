class BaseOMS {
  constructor(config) {
    this.name = 'base';
    this.config = config;
  }

  async connect() { throw new Error('connect() must be implemented'); }
  async disconnect() { throw new Error('disconnect() must be implemented'); }

  async placeOrder(order) { throw new Error('placeOrder() must be implemented'); }
  async modifyOrder(orderId, modifications) { throw new Error('modifyOrder() must be implemented'); }
  async cancelOrder(orderId) { throw new Error('cancelOrder() must be implemented'); }
  async getOrderBook() { throw new Error('getOrderBook() must be implemented'); }
  async getPositions() { throw new Error('getPositions() must be implemented'); }
  async getQuote(symbol) { throw new Error('getQuote() must be implemented'); }
}

module.exports = { BaseOMS };
