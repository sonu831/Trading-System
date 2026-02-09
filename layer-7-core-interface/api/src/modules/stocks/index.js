/**
 * Stocks Module - Index
 */
const StocksService = require('./StocksService');
const StocksController = require('./StocksController');
const routes = require('./routes');

module.exports = {
  StocksService,
  StocksController,
  routes,
};
