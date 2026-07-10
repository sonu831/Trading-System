const { Pool } = require('pg');
const logger = require('./utils/logger');

class TradeJournal {
  constructor(config) {
    this.pool = new Pool({ connectionString: config.timescale.url });
    this.orderTagPrefix = config.oms.orderTagPrefix;
  }

  async recordTrade(trade) {
    const query = `INSERT INTO trades (time, trade_id, symbol, strategy_id, tier, action, direction, instrument_type, strike, expiry, option_type, lots, entry_price, exit_price, sl_price, target_price, pnl, slippage, broker, order_tag, exit_reason, regime_snapshot, breadth_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`;
    const values = [
      new Date(), trade.id || `trade-${Date.now()}`, trade.symbol, trade.strategyId, trade.tier,
      trade.action || 'ENTRY', trade.direction, trade.instrument || 'OPTION',
      trade.strike || null, trade.expiry || null, trade.optionType || null, trade.lots || 1,
      trade.entryPrice || 0, trade.exitPrice || null, trade.stopLoss || null, trade.target || null,
      trade.pnl || 0, trade.slippage || 0, trade.broker || 'paper',
      `${this.orderTagPrefix}-${Date.now()}`, trade.exitReason || null,
      trade.regime ? JSON.stringify(trade.regime) : null,
      trade.breadthSnapshot ? JSON.stringify(trade.breadthSnapshot) : null,
    ];
    try { await this.pool.query(query, values); } catch (err) { logger.error({ err }, 'Trade journal: insert failed'); }
  }

  async recordOrder(order) {
    const query = `INSERT INTO order_log (time, order_id, trade_id, symbol, action, order_type, quantity, price, trigger_price, status, broker, latency_ms, error, raw_response) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`;
    const values = [
      new Date(), order.orderId || `ord-${Date.now()}`, order.tradeId,
      order.symbol, order.action, order.orderType || 'MARKET',
      order.quantity || 0, order.price || 0, order.triggerPrice || 0,
      order.status || 'PENDING', order.broker || 'paper',
      order.latencyMs || 0, order.error || null,
      order.rawResponse ? JSON.stringify(order.rawResponse) : null,
    ];
    try { await this.pool.query(query, values); } catch (err) { logger.error({ err }, 'Trade journal: order_log insert failed'); }
  }

  async recordPnlSnapshot(tradeId, symbol, spotPrice, optionLtp, iv, delta, theta, unrealizedPnl) {
    const query = `INSERT INTO pnl_snapshots (time, trade_id, symbol, unrealized_pnl, premium, spot_price, option_ltp, iv, delta, theta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
    const values = [new Date(), tradeId, symbol, unrealizedPnl || 0, optionLtp || 0, spotPrice || 0, optionLtp || 0, iv || 0, delta || 0, theta || 0];
    try { await this.pool.query(query, values); } catch (err) { logger.error({ err }, 'Trade journal: pnl_snapshot insert failed'); }
  }

  async close() { await this.pool.end(); }
}

module.exports = { TradeJournal };
