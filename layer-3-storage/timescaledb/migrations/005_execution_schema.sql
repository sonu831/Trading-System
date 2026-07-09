-- ============================================
-- MIGRATION 005: EXECUTION SCHEMA
-- ============================================
-- For Layer 10: trade journal, order log, P&L snapshots
-- ============================================

-- 1. TRADES HYPERTABLE
CREATE TABLE IF NOT EXISTS trades (
    time            TIMESTAMPTZ NOT NULL,
    trade_id        TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    strategy_id     TEXT,
    tier            TEXT, -- T1 | T2 | T3
    action          TEXT NOT NULL, -- ENTRY | EXIT
    direction       TEXT NOT NULL, -- LONG | SHORT
    instrument_type TEXT NOT NULL, -- OPTION | FUTURE
    strike          DECIMAL(10,2),
    expiry          DATE,
    option_type     TEXT, -- CE | PE
    lots            INTEGER NOT NULL DEFAULT 1,
    entry_price     DECIMAL(10,2),
    exit_price      DECIMAL(10,2),
    sl_price        DECIMAL(10,2),
    target_price    DECIMAL(10,2),
    pnl             DECIMAL(12,2),
    slippage        DECIMAL(10,2),
    broker          TEXT,
    order_tag       TEXT,
    exit_reason     TEXT,
    regime_snapshot JSONB,
    breadth_snapshot JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('trades', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades (strategy_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_tier ON trades (tier, time DESC);

-- 2. ORDER LOG HYPERTABLE
CREATE TABLE IF NOT EXISTS order_log (
    time            TIMESTAMPTZ NOT NULL,
    order_id        TEXT NOT NULL,
    trade_id        TEXT,
    symbol          TEXT NOT NULL,
    action          TEXT NOT NULL, -- PLACE | MODIFY | CANCEL | FILL | REJECT
    order_type      TEXT, -- MARKET | LIMIT | SL_M | SL_L
    quantity        INTEGER,
    price           DECIMAL(10,2),
    trigger_price   DECIMAL(10,2),
    status          TEXT,
    broker_order_id TEXT,
    broker          TEXT,
    latency_ms      INTEGER,
    error           TEXT,
    raw_response    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('order_log', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_order_log_order_id ON order_log (order_id);
CREATE INDEX IF NOT EXISTS idx_order_log_trade_id ON order_log (trade_id);

-- 3. P&L SNAPSHOTS HYPERTABLE
CREATE TABLE IF NOT EXISTS pnl_snapshots (
    time            TIMESTAMPTZ NOT NULL,
    trade_id        TEXT,
    symbol          TEXT NOT NULL,
    unrealized_pnl  DECIMAL(12,2),
    realized_pnl    DECIMAL(12,2),
    premium         DECIMAL(10,2),
    spot_price      DECIMAL(10,2),
    option_ltp      DECIMAL(10,2),
    iv              DECIMAL(8,4),
    delta           DECIMAL(8,4),
    theta           DECIMAL(8,4),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('pnl_snapshots', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_trade ON pnl_snapshots (trade_id, time DESC);

-- 4. COMPRESSION POLICIES (apply after 7 days)
ALTER TABLE trades SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'time DESC'
);

ALTER TABLE order_log SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'time DESC'
);

ALTER TABLE pnl_snapshots SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('trades', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('order_log', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('pnl_snapshots', INTERVAL '7 days', if_not_exists => TRUE);
