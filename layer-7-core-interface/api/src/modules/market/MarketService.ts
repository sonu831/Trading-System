const BaseService = require('../../common/services/BaseService');

class MarketService extends BaseService {
  marketRepository: any;

  constructor({ marketRepository }: { marketRepository: any }) {
    super({ repository: marketRepository });
    this.marketRepository = marketRepository;
  }

  async getMarketView() {
    // Try Redis cache first
    const cached = await this.marketRepository.getLatestMarketView();
    if (cached && cached.all_stocks?.length) return cached;

    // Fetch live from MStock
    return this.fetchLiveSnapshot();
  }

  async fetchLiveSnapshot() {
    const { getAdapter } = require('../broker/adapters');
    const brokerService = require('../../container').resolve('brokerService');
    const creds = await brokerService.getDecryptedCredentials('mstock');
    if (!creds?.api_key) return { message: 'MStock not configured', status: 'WAITING' };

    const { createClient } = require('redis');
    const r = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
    await r.connect();
    const raw = await r.get('broker:session:mstock');
    await r.disconnect();
    const jwt = raw ? JSON.parse(raw)?.token : null;
    if (!jwt) return { message: 'No session token. Run Test Connection.', status: 'WAITING' };

    const adapter = getAdapter('mstock', creds.api_key);
    adapter.setAccessToken(jwt);

    // Load token map
    let masterMap: any[] = [];
    try { masterMap = require('/app/vendor/nifty50_shared.json'); } catch (_) {}
    if (!masterMap.length) {
      try { masterMap = require('../../../../vendor/nifty50_shared.json'); } catch (_) {}
    }

    const allTokens: string[] = [];
    const tokenMap: Record<string, string> = {};
    for (const item of masterMap) {
      const t = item.tokens?.mstock;
      if (t && t !== 'TODO_VERIFY_FROM_MSTOCK_UI' && item.isIndex !== true) {
        allTokens.push(t);
        tokenMap[t] = item.symbol;
      }
    }
    // Add indices
    allTokens.push('26000'); tokenMap['26000'] = 'NIFTY';
    allTokens.push('26009'); tokenMap['26009'] = 'BANKNIFTY';

    const result = await adapter.getQuote({ mode: 'LTP', exchangeTokens: { NSE: allTokens } });
    const fetched: any[] = result?.data?.fetched || result?.fetched || [];

    const allStocks: any[] = [];
    const indices: Record<string, any> = {};
    let advances = 0, declines = 0;

    for (const f of fetched) {
      const t = f.symbolToken || f.token;
      const symbol = tokenMap[t] || f.tradingSymbol || t;
      const ltp = Number(f.ltp) || 0;
      const change = Number(f.change) || 0;
      const changePct = Number(f.change_pct) || 0;

      if (symbol === 'NIFTY' || symbol === 'BANKNIFTY') {
        indices[symbol] = { ltp, change, changePct };
        continue;
      }

      const trend = change > 0 ? 'UP' : change < 0 ? 'DOWN' : 'FLAT';
      if (change > 0) advances++;
      else if (change < 0) declines++;

      allStocks.push({
        symbol, ltp, change_pct: changePct || 0, change: change || 0, volume: 0,
        rsi: 0, trend, score: 0,
      });
    }

    const snapshot = {
      indices,
      all_stocks: allStocks,
      smartPicks: [],
      marketSummary: '',
      marketStatus: 'OPEN',
      marketSentiment: advances > declines ? 'Bullish' : declines > advances ? 'Bearish' : 'Neutral',
      advanceDecline: { advances, declines, neutral: allStocks.length - advances - declines },
      lastUpdated: new Date().toISOString(),
    };

    // Cache in Redis
    this.marketRepository.redis?.set?.('market_view:latest', JSON.stringify(snapshot), { EX: 5 }).catch(() => {});

    return snapshot;
  }
}

module.exports = MarketService;
