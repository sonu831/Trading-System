#!/usr/bin/env node
/**
 * Nifty50 Stocks CLI Helper
 * 
 * Usage:
 *   node getNifty50Stocks.js                    # List all symbols
 *   node getNifty50Stocks.js --sectors          # List all sectors
 *   node getNifty50Stocks.js --sector Banking   # Get stocks in sector
 *   node getNifty50Stocks.js --symbol RELIANCE  # Get stock details
 *   node getNifty50Stocks.js --json             # Full JSON output
 */

const loader = require('../stocks/loader');

const args = process.argv.slice(2);

function main() {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Nifty50 Stocks CLI

Commands:
  (no args)              List all symbols (one per line)
  --json                 Output full stock data as JSON
  --sectors              List all unique sectors
  --sector <name>        List stocks in a specific sector
  --symbol <ticker>      Get details for a specific stock
  --count                Show total stock count
    `);
    return;
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(loader.getAllStocks(), null, 2));
    return;
  }

  if (args.includes('--sectors')) {
    loader.getSectors().forEach(s => console.log(s));
    return;
  }

  if (args.includes('--sector')) {
    const sectorIdx = args.indexOf('--sector');
    const sector = args[sectorIdx + 1];
    if (!sector) {
      console.error('Error: --sector requires a sector name');
      process.exit(1);
    }
    const stocks = loader.getStocksBySector()[sector] || [];
    stocks.forEach(s => console.log(s));
    return;
  }

  if (args.includes('--symbol')) {
    const symbolIdx = args.indexOf('--symbol');
    const symbol = args[symbolIdx + 1];
    if (!symbol) {
      console.error('Error: --symbol requires a symbol name');
      process.exit(1);
    }
    const stock = loader.getStockBySymbol(symbol.toUpperCase());
    if (stock) {
      console.log(JSON.stringify(stock, null, 2));
    } else {
      console.error(`Stock not found: ${symbol}`);
      process.exit(1);
    }
    return;
  }

  if (args.includes('--count')) {
    console.log(loader.getSymbols().length);
    return;
  }

  // Default: list all symbols
  loader.getSymbols().forEach(s => console.log(s));
}

main();
