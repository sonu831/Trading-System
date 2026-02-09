/**
 * Stocks Controller - API handlers for stock data
 */
class StocksController {
  constructor(stocksService) {
    this.stocksService = stocksService;
    
    // Bind methods
    this.getSymbols = this.getSymbols.bind(this);
    this.getAllStocks = this.getAllStocks.bind(this);
    this.getStock = this.getStock.bind(this);
    this.getSectors = this.getSectors.bind(this);
    this.getStocksBySector = this.getStocksBySector.bind(this);
    this.getSectorMap = this.getSectorMap.bind(this);
  }

  /**
   * GET /api/v1/stocks/symbols - List all symbols
   */
  async getSymbols(request, reply) {
    const symbols = await this.stocksService.getSymbols();
    return reply.send({
      success: true,
      count: symbols.length,
      symbols,
    });
  }

  /**
   * GET /api/v1/stocks - Full stock list with metadata
   */
  async getAllStocks(request, reply) {
    const stocks = await this.stocksService.getAllStocks();
    return reply.send({
      success: true,
      count: stocks.length,
      stocks,
    });
  }

  /**
   * GET /api/v1/stocks/:symbol - Single stock details
   */
  async getStock(request, reply) {
    const { symbol } = request.params;
    const stock = await this.stocksService.getStockBySymbol(symbol.toUpperCase());
    
    if (!stock) {
      return reply.code(404).send({
        success: false,
        error: `Stock not found: ${symbol}`,
      });
    }

    return reply.send({
      success: true,
      stock,
    });
  }

  /**
   * GET /api/v1/stocks/sectors - All sectors with grouped stocks
   */
  async getSectors(request, reply) {
    const sectors = await this.stocksService.getSectors();
    return reply.send({
      success: true,
      count: sectors.length,
      sectors,
    });
  }

  /**
   * GET /api/v1/stocks/by-sector - Stocks grouped by sector
   */
  async getStocksBySector(request, reply) {
    const stocksBySector = await this.stocksService.getStocksBySector();
    return reply.send({
      success: true,
      sectors: stocksBySector,
    });
  }

  /**
   * GET /api/v1/stocks/sector-map - Symbol -> Sector mapping
   */
  async getSectorMap(request, reply) {
    const sectorMap = await this.stocksService.getSectorMap();
    return reply.send({
      success: true,
      count: Object.keys(sectorMap).length,
      sectorMap,
    });
  }
}

module.exports = StocksController;
