const fs = require('fs');
const path = require('path');

const kitePath = path.resolve(__dirname, '../layer-1-ingestion/config/symbols.json');
const mstockPath = path.resolve(__dirname, '../vendor/mstock/nifty50.json');
const outputPath = path.resolve(__dirname, '../vendor/nifty50_shared.json');

const kiteData = require(kitePath);
const mstockData = require(mstockPath);

console.log(`Loaded ${kiteData.nifty50.length} Kite Symbols`);
console.log(`Loaded ${mstockData.length} MStock Symbols`);

const masterMap = kiteData.nifty50.map((kiteItem) => {
  // Find matching MStock item
  // MStock symbols have '-EQ' suffix usually
  const mstockItem = mstockData.find((m) => {
    const cleanMStock = m.symbol.replace('-EQ', '').trim();
    const cleanKite = kiteItem.symbol.trim();
    return cleanMStock === cleanKite;
  });

  if (!mstockItem) {
    console.warn(`⚠️ No MStock match for ${kiteItem.symbol}`);
  }

  return {
    symbol: kiteItem.symbol,
    exchange: kiteItem.exchange,
    sector: kiteItem.sector,
    tokens: {
      kite: String(kiteItem.token),
      mstock: mstockItem ? String(mstockItem.token) : null,
    },
  };
});

fs.writeFileSync(outputPath, JSON.stringify(masterMap, null, 2));
console.log(`✅ Generated Master Map at ${outputPath}`);
