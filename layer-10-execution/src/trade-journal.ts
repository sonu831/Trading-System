const { Pool } = require('pg');
const { logger } = require('./utils/logger');

interface TradeRecord {
  id?: string;
  symbol: string;
  strategyId?: string;
  tier?: string;
  action?: string;
  direction?: string;
  instrument?: string;
  strike?: number | null;
  expiry?: string | null;
  optionType?: string | null;
  lots: number | null;
  entryPrice: number | null;
  exitPrice?: number | null;
  stopLoss?: number | null;
  target?: number | null;
  pnl: number | null;
  slippage?: number | null;
  broker?: string;
  exitReason?: string | null;
  regime?: Record<string, unknown>;
  breadthSnapshot?: Record<string, unknown>;
}

interface OrderRecord {
  orderId?: string;
  tradeId?: string;
  symbol: string;
  action: string;
  orderType?: string;
  quantity: number | null;
  price: number | null;
  triggerPrice?: number | null;
  status?: string;
  broker?: string;
  latencyMs?: number;
  error?: string | null;
  rawResponse?: unknown;
}

interface TradeJournalConfig {
  timescale: { url: string };
  oms: { orderTagPrefix: string };
}

class TradeJournal {
  private pool: Pool;
  private orderTagPrefix: string;

  constructor(config: TradeJournalConfig) {
    this.pool = new Pool({ connectionString: config.timescale.url });
    this.orderTagPrefix = config.oms.orderTagPrefix;
  }

  async recordTrade(trade: TradeRecord): Promise<void> {
    const query = `INSERT INTO trades (time, trade_id, symbol, strategy_id, tier, action, direction, instrument_type, strike, expiry, option_type, lots, entry_price, exit_price, sl_price, target_price, pnl, slippage, broker, order_tag, exit_reason, regime_snapshot, breadth_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`;
    const values = [
      new Date(), trade.id || `trade-${Date.now()}`, trade.symbol, trade.strategyId, trade.tier,
      trade.action || 'ENTRY', trade.direction, trade.instrument || 'OPTION',
      trade.strike || null, trade.expiry || null, trade.optionType || null, trade.lots ?? null,
      trade.entryPrice ?? null, trade.exitPrice ?? null, trade.stopLoss ?? null, trade.target ?? null,
      trade.pnl ?? null, trade.slippage ?? null, trade.broker || 'paper',
      `${this.orderTagPrefix}-${Date.now()}`, trade.exitReason || null,
      trade.regime ? JSON.stringify(trade.regime) : null,
      trade.breadthSnapshot ? JSON.stringify(trade.breadthSnapshot) : null,
    ];
    if (trade.pnl == null) logger.warn({ tradeId: trade.id }, 'Trade logged with null P&L');
    try { await this.pool.query(query, values); }
    catch (err: any) { logger.error({ err }, 'Trade journal: insert failed'); }
  }

  async recordOrder(order: OrderRecord): Promise<void> {
    const query = `INSERT INTO order_log (time, order_id, trade_id, symbol, action, order_type, quantity, price, trigger_price, status, broker, latency_ms, error, raw_response) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`;
    const values = [
      new Date(), order.orderId || `ord-${Date.now()}`, order.tradeId,
      order.symbol, order.action, order.orderType || 'MARKET',
      order.quantity ?? null, order.price ?? null, order.triggerPrice ?? null,
      order.status || 'PENDING', order.broker || 'paper',
      order.latencyMs ?? null, order.error || null,
      order.rawResponse ? JSON.stringify(order.rawResponse) : null,
    ];
    try { await this.pool.query(query, values); }
    catch (err: any) { logger.error({ err }, 'Trade journal: order_log failed'); }
  }

  async recordPnlSnapshot(
    tradeId: string, symbol: string, spotPrice: number | null,
    optionLtp: number | null, iv: number | null, delta: number | null,
    theta: number | null, unrealizedPnl: number | null
  ): Promise<void> {
    const query = `INSERT INTO pnl_snapshots (time, trade_id, symbol, unrealized_pnl, premium, spot_price, option_ltp, iv, delta, theta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
    const values = [new Date(), tradeId, symbol,
      unrealizedPnl ?? null, optionLtp ?? null, spotPrice ?? null,
      optionLtp ?? null, iv ?? null, delta ?? null, theta ?? null,
    ];
    try { await this.pool.query(query, values); }
    catch (err: any) { logger.error({ err }, 'Trade journal: pnl_snapshot failed'); }
  }

  async close(): Promise<void> { await this.pool.end(); }

  async getAll(): Promise<OrderRecord[]> {
    try {
      const result = await this.pool.query(
        `SELECT time, order_id AS "orderId", trade_id AS "tradeId", symbol, action, order_type AS "orderType",
                quantity, price, trigger_price AS "triggerPrice", status, broker, latency_ms AS "latencyMs",
                error, raw_response AS "rawResponse"
         FROM order_log ORDER BY time DESC LIMIT 500`
      );
      return result.rows;
    } catch (err: any) {
      logger.error({ err }, 'Trade journal: getAll failed');
      return [];
    }
  }
}

export = { TradeJournal };
