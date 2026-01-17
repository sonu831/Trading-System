-- ============================================
-- Nifty 50 Trading System - Database Schema
-- Layer 3: Storage Layer - TimescaleDB
-- ============================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================
-- 1. CANDLES TABLE (1-minute)
-- ============================================
CREATE TABLE IF NOT EXISTS candles_1m (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT NOT NULL,
    exchange    TEXT DEFAULT 'NSE',
    open        DECIMAL(12,2) NOT NULL,
    high        DECIMAL(12,2) NOT NULL,
    low         DECIMAL(12,2) NOT NULL,
    close       DECIMAL(12,2) NOT NULL,
    volume      BIGINT DEFAULT 0,
    vwap        DECIMAL(12,2),
    trades      INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable (auto-partitioning by time)
SELECT create_hypertable('candles_1m', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candles_1m_symbol_time 
    ON candles_1m (symbol, time DESC);

-- Enable compression (after 7 days)
ALTER TABLE candles_1m SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol'
);

SELECT add_compression_policy('candles_1m', INTERVAL '7 days', if_not_exists => TRUE);

-- Retention policy (keep 30 days)
SELECT add_retention_policy('candles_1m', INTERVAL '30 days', if_not_exists => TRUE);


-- ============================================
-- 2. CONTINUOUS AGGREGATES (5m, 15m candles)
-- ============================================

-- 5-minute candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(volume * vwap) / NULLIF(sum(volume), 0) AS vwap,
    sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('5 minutes', time), symbol, exchange
WITH NO DATA;

-- Refresh policy for 5m candles
SELECT add_continuous_aggregate_policy('candles_5m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE
);

-- 15-minute candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_15m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('15 minutes', time), symbol, exchange
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_15m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE
);


-- ============================================
-- 3. OPTIONS CHAIN TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS options_chain (
    time            TIMESTAMPTZ NOT NULL,
    symbol          TEXT NOT NULL,
    expiry          DATE NOT NULL,
    strike          DECIMAL(10,2) NOT NULL,
    option_type     TEXT NOT NULL, -- 'CE' or 'PE'
    ltp             DECIMAL(10,2),
    open_interest   BIGINT,
    volume          BIGINT,
    iv              DECIMAL(8,4),
    delta           DECIMAL(8,4),
    gamma           DECIMAL(8,4),
    theta           DECIMAL(8,4),
    vega            DECIMAL(8,4),
    bid             DECIMAL(10,2),
    ask             DECIMAL(10,2)
);

SELECT create_hypertable('options_chain', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_options_symbol_expiry 
    ON options_chain (symbol, expiry, strike, option_type, time DESC);


-- ============================================
-- 4. SIGNALS HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS signals (
    id              SERIAL,
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signal_type     TEXT NOT NULL, -- 'BUY', 'SELL', 'NEUTRAL'
    strength        TEXT, -- 'STRONG', 'MODERATE', 'WEAK'
    instrument      TEXT NOT NULL, -- 'NIFTY 24500 CE'
    entry_price     DECIMAL(10,2),
    stop_loss       DECIMAL(10,2),
    target          DECIMAL(10,2),
    confidence      DECIMAL(5,2), -- 0-100
    composite_score DECIMAL(5,4), -- -1 to +1
    
    -- Factor scores
    trend_score     DECIMAL(5,4),
    breadth_score   DECIMAL(5,4),
    momentum_score  DECIMAL(5,4),
    options_score   DECIMAL(5,4),
    sector_score    DECIMAL(5,4),
    volatility_score DECIMAL(5,4),
    
    -- Metadata
    nifty_price     DECIMAL(10,2),
    market_regime   TEXT,
    executed        BOOLEAN DEFAULT FALSE,
    notes           TEXT
);

SELECT create_hypertable('signals', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);


-- ============================================
-- 5. MARKET BREADTH HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS market_breadth (
    time                TIMESTAMPTZ NOT NULL,
    advancing           INTEGER,
    declining           INTEGER,
    unchanged           INTEGER,
    ad_ratio            DECIMAL(6,4),
    new_highs           INTEGER,
    new_lows            INTEGER,
    above_vwap_pct      DECIMAL(5,2),
    above_200ema_pct    DECIMAL(5,2),
    mcclellan_oscillator DECIMAL(8,4)
);

SELECT create_hypertable('market_breadth', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);


-- ============================================
-- 6. SECTOR STRENGTH TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sector_strength (
    time            TIMESTAMPTZ NOT NULL,
    sector          TEXT NOT NULL,
    strength_score  DECIMAL(5,4), -- -1 to +1
    rotation_phase  TEXT, -- 'LEADING', 'WEAKENING', 'LAGGING', 'IMPROVING'
    top_stock       TEXT,
    bottom_stock    TEXT
);

SELECT create_hypertable('sector_strength', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);


-- ============================================
-- HELPFUL VIEWS
-- ============================================

-- Latest price for each symbol
CREATE OR REPLACE VIEW latest_prices AS
SELECT DISTINCT ON (symbol)
    symbol,
    time,
    close as price,
    volume
FROM candles_1m
ORDER BY symbol, time DESC;

-- Today's OHLC
CREATE OR REPLACE VIEW daily_ohlc AS
SELECT 
    symbol,
    first(open, time) as open,
    max(high) as high,
    min(low) as low,
    last(close, time) as close,
    sum(volume) as volume
FROM candles_1m
WHERE time >= CURRENT_DATE
GROUP BY symbol;


-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO trading;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading;
