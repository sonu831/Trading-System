-- ============================================
-- Nifty 50 Trading System - Master Schema
-- Description: Consolidated Schema (previously split across 001-005)
-- Verified: 2026-02-08
-- ============================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. CORE MARKET DATA (Hypertables)
-- ============================================

-- CANDLES (1-Minute Source of Truth)
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
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint added forduplicate prevention
    UNIQUE (time, symbol)
);

SELECT create_hypertable('candles_1m', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_candles_1m_symbol_time ON candles_1m (symbol, time DESC);

-- Compression Policy
ALTER TABLE candles_1m SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol');
SELECT add_compression_policy('candles_1m', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('candles_1m', INTERVAL '30 days', if_not_exists => TRUE);

-- OPTIONS CHAIN
CREATE TABLE IF NOT EXISTS options_chain (
    time            TIMESTAMPTZ NOT NULL,
    symbol          TEXT NOT NULL,
    expiry          DATE NOT NULL,
    strike          DECIMAL(10,2) NOT NULL,
    option_type     TEXT NOT NULL,
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

SELECT create_hypertable('options_chain', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_options_symbol_expiry ON options_chain (symbol, expiry, strike, option_type, time DESC);

-- SIGNALS
CREATE TABLE IF NOT EXISTS signals (
    id              SERIAL,
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signal_type     TEXT NOT NULL,
    strength        TEXT,
    instrument      TEXT NOT NULL,
    entry_price     DECIMAL(10,2),
    stop_loss       DECIMAL(10,2),
    target          DECIMAL(10,2),
    confidence      DECIMAL(5,2),
    composite_score DECIMAL(5,4),
    trend_score     DECIMAL(5,4),
    breadth_score   DECIMAL(5,4),
    momentum_score  DECIMAL(5,4),
    options_score   DECIMAL(5,4),
    sector_score    DECIMAL(5,4),
    volatility_score DECIMAL(5,4),
    nifty_price     DECIMAL(10,2),
    market_regime   TEXT,
    executed        BOOLEAN DEFAULT FALSE,
    notes           TEXT
);
SELECT create_hypertable('signals', 'time', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

-- MARKET BREADTH
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
SELECT create_hypertable('market_breadth', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- SECTOR STRENGTH
CREATE TABLE IF NOT EXISTS sector_strength (
    time            TIMESTAMPTZ NOT NULL,
    sector          TEXT NOT NULL,
    strength_score  DECIMAL(5,4),
    rotation_phase  TEXT,
    top_stock       TEXT,
    bottom_stock    TEXT
);
SELECT create_hypertable('sector_strength', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- ============================================
-- 3. CONTINUOUS AGGREGATES (Multi-Timeframe)
-- ============================================

-- 5m
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_5m WITH (timescaledb.continuous) AS
SELECT time_bucket('5 minutes', time) AS time, symbol, exchange, first(open, time) AS open, max(high) AS high, min(low) AS low, last(close, time) AS close, sum(volume) AS volume, sum(volume * vwap) / NULLIF(sum(volume), 0) AS vwap, sum(trades) AS trades
FROM candles_1m GROUP BY time_bucket('5 minutes', time), symbol, exchange WITH NO DATA;
SELECT add_continuous_aggregate_policy('candles_5m', start_offset => INTERVAL '1 hour', end_offset => INTERVAL '5 minutes', schedule_interval => INTERVAL '5 minutes', if_not_exists => TRUE);

-- 10m
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_10m WITH (timescaledb.continuous) AS
SELECT time_bucket('10 minutes', time) AS time, symbol, exchange, first(open, time) AS open, max(high) AS high, min(low) AS low, last(close, time) AS close, sum(volume) AS volume, sum(trades) AS trades
FROM candles_1m GROUP BY time_bucket('10 minutes', time), symbol, exchange WITH NO DATA;
SELECT add_continuous_aggregate_policy('candles_10m', start_offset => INTERVAL '1 hour', end_offset => INTERVAL '10 minutes', schedule_interval => INTERVAL '10 minutes', if_not_exists => TRUE);

-- 15m
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_15m WITH (timescaledb.continuous) AS
SELECT time_bucket('15 minutes', time) AS time, symbol, exchange, first(open, time) AS open, max(high) AS high, min(low) AS low, last(close, time) AS close, sum(volume) AS volume, sum(trades) AS trades
FROM candles_1m GROUP BY time_bucket('15 minutes', time), symbol, exchange WITH NO DATA;
SELECT add_continuous_aggregate_policy('candles_15m', start_offset => INTERVAL '2 hours', end_offset => INTERVAL '15 minutes', schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);

-- 30m
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_30m WITH (timescaledb.continuous) AS
SELECT time_bucket('30 minutes', time) AS time, symbol, exchange, first(open, time) AS open, max(high) AS high, min(low) AS low, last(close, time) AS close, sum(volume) AS volume, sum(trades) AS trades
FROM candles_1m GROUP BY time_bucket('30 minutes', time), symbol, exchange WITH NO DATA;
SELECT add_continuous_aggregate_policy('candles_30m', start_offset => INTERVAL '2 hours', end_offset => INTERVAL '30 minutes', schedule_interval => INTERVAL '30 minutes', if_not_exists => TRUE);

-- 1h
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1h WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS time, symbol, exchange, first(open, time) AS open, max(high) AS high, min(low) AS low, last(close, time) AS close, sum(volume) AS volume, sum(trades) AS trades
FROM candles_1m GROUP BY time_bucket('1 hour', time), symbol, exchange WITH NO DATA;
SELECT add_continuous_aggregate_policy('candles_1h', start_offset => INTERVAL '4 hours', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '1 hour', if_not_exists => TRUE);

-- 1d
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1d WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS time, symbol, exchange, first(open, time) AS open, max(high) AS high, min(low) AS low, last(close, time) AS close, sum(volume) AS volume, sum(trades) AS trades
FROM candles_1m GROUP BY time_bucket('1 day', time), symbol, exchange WITH NO DATA;
SELECT add_continuous_aggregate_policy('candles_1d', start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 day', schedule_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Weekly
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_weekly WITH (timescaledb.continuous) AS
SELECT time_bucket('1 week', time) AS time, symbol, exchange, first(open, time) AS open, max(high) AS high, min(low) AS low, last(close, time) AS close, sum(volume) AS volume, sum(trades) AS trades
FROM candles_1m GROUP BY time_bucket('1 week', time), symbol, exchange WITH NO DATA;
SELECT add_continuous_aggregate_policy('candles_weekly', start_offset => INTERVAL '1 month', end_offset => INTERVAL '1 week', schedule_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- ============================================
-- 4. MASTER DATA & METADATA
-- ============================================

-- Sectors
CREATE TABLE IF NOT EXISTS sectors (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    display_name    TEXT,
    description     TEXT,
    weight          DECIMAL(5,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO sectors (name, display_name) VALUES ('IT', 'Information Technology'), ('BANKING', 'Banking & Financial Services'), ('AUTO', 'Automobile'), ('PHARMA', 'Pharmaceuticals'), ('FMCG', 'Fast Moving Consumer Goods'), ('ENERGY', 'Oil & Gas'), ('METALS', 'Metals & Mining'), ('REALTY', 'Real Estate'), ('TELECOM', 'Telecommunications'), ('INFRA', 'Infrastructure') ON CONFLICT (name) DO NOTHING;

-- Instruments
CREATE TABLE IF NOT EXISTS instruments (
    id              SERIAL PRIMARY KEY,
    symbol          TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    isin            TEXT,
    exchange        TEXT DEFAULT 'NSE',
    sector_id       INTEGER REFERENCES sectors(id),
    industry        TEXT,
    lot_size        INTEGER DEFAULT 1,
    tick_size       DECIMAL(6,2) DEFAULT 0.05,
    token           TEXT,
    is_nifty50      BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    listed_date     DATE,
    face_value      DECIMAL(10,2),
    market_cap      BIGINT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_instruments_sector ON instruments(sector_id);
CREATE INDEX IF NOT EXISTS idx_instruments_nifty50 ON instruments(is_nifty50) WHERE is_nifty50 = TRUE;

-- Trading Calendar
CREATE TABLE IF NOT EXISTS trading_calendar (
    date            DATE PRIMARY KEY,
    is_trading_day  BOOLEAN DEFAULT TRUE,
    holiday_name    TEXT,
    market_open     TIME DEFAULT '09:15:00',
    market_close    TIME DEFAULT '15:30:00',
    is_special      BOOLEAN DEFAULT FALSE,
    notes           TEXT
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    telegram_id     BIGINT UNIQUE,
    email           TEXT,
    phone           TEXT,
    name            TEXT,
    is_premium      BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_active     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User Alerts
CREATE TABLE IF NOT EXISTS user_alerts (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    symbol          TEXT,
    alert_type      TEXT NOT NULL,
    condition       TEXT NOT NULL,
    threshold       DECIMAL(12,2),
    is_active       BOOLEAN DEFAULT TRUE,
    triggered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON user_alerts(user_id);

-- User Watchlists
CREATE TABLE IF NOT EXISTS user_watchlists (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    name            TEXT NOT NULL,
    symbols         TEXT[] NOT NULL,
    is_default      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- DATA AVAILABILITY (Watermark System)
CREATE TABLE IF NOT EXISTS data_availability (
    id              SERIAL PRIMARY KEY,
    symbol          TEXT NOT NULL,
    timeframe       TEXT NOT NULL,
    first_date      DATE NOT NULL,
    last_date       DATE NOT NULL,
    total_records   BIGINT DEFAULT 0,
    gaps            JSONB DEFAULT '[]',
    quality_score   DECIMAL(5,2),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- Strict Unique Constraint on Symbol only (per requirement)
    UNIQUE(symbol)
);
CREATE INDEX IF NOT EXISTS idx_data_availability_symbol ON data_availability(symbol);

-- Backfill Jobs
CREATE TABLE IF NOT EXISTS backfill_jobs (
    id              SERIAL PRIMARY KEY,
    job_id          UUID DEFAULT gen_random_uuid(),
    status          TEXT DEFAULT 'PENDING',
    symbols         TEXT[],
    timeframe       TEXT,
    start_date      DATE,
    end_date        DATE,
    total_records   BIGINT DEFAULT 0,
    processed       BIGINT DEFAULT 0,
    errors          JSONB DEFAULT '[]',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    triggered_by    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backfill_jobs_status ON backfill_jobs(status);

-- System Config
CREATE TABLE IF NOT EXISTS system_config (
    key             TEXT PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      TEXT
);
INSERT INTO system_config (key, value, description) VALUES ('data_retention_days', '{"ticks": 30, "candles_1m": 365, "candles_1d": 3650}', 'Data retention by timeframe'), ('compression_delay_hours', '{"ticks": 24, "candles_1m": 168}', 'Hours before compression'), ('nifty50_last_updated', '"2026-01-21"', 'Last Nifty 50 constituent update') ON CONFLICT (key) DO NOTHING;

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL,
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type      TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    action          TEXT,
    details         JSONB,
    user_id         INTEGER
);
SELECT create_hypertable('audit_log', 'time', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('audit_log', INTERVAL '90 days', if_not_exists => TRUE);

-- Backup Logs
CREATE TABLE IF NOT EXISTS backup_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    backup_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    location TEXT,
    duration_seconds INTEGER,
    details TEXT
);
CREATE INDEX IF NOT EXISTS idx_backup_logs_timestamp ON backup_logs(timestamp DESC);

-- Technical Indicators Cache
CREATE TABLE IF NOT EXISTS technical_indicators (
    time            TIMESTAMPTZ NOT NULL,
    symbol          TEXT NOT NULL,
    timeframe       TEXT NOT NULL,
    ema_9           DECIMAL(12,2),
    ema_21          DECIMAL(12,2),
    ema_50          DECIMAL(12,2),
    ema_200         DECIMAL(12,2),
    sma_20          DECIMAL(12,2),
    rsi_14          DECIMAL(8,4),
    macd            DECIMAL(12,4),
    macd_signal     DECIMAL(12,4),
    macd_histogram  DECIMAL(12,4),
    atr_14          DECIMAL(12,4),
    bb_upper        DECIMAL(12,2),
    bb_middle       DECIMAL(12,2),
    bb_lower        DECIMAL(12,2),
    vwap            DECIMAL(12,2),
    obv             BIGINT,
    trend_score     DECIMAL(5,4),
    momentum_score  DECIMAL(5,4),
    volatility_score DECIMAL(5,4)
);
SELECT create_hypertable('technical_indicators', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_tech_indicators_symbol_tf ON technical_indicators(symbol, timeframe, time DESC);

-- ============================================
-- 5. BILLING & SUBSCRIPTIONS
-- ============================================

-- Plans
CREATE TABLE IF NOT EXISTS plans (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    description     TEXT,
    price_monthly   DECIMAL(10,2) DEFAULT 0,
    price_yearly    DECIMAL(10,2) DEFAULT 0,
    currency        TEXT DEFAULT 'INR',
    features        JSONB DEFAULT '{}',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO plans (name, display_name, price_monthly, features) VALUES ('free', 'Free Tier', 0, '{"max_alerts": 3, "max_watchlists": 1, "api_access": false}'), ('basic', 'Basic', 299, '{"max_alerts": 10, "max_watchlists": 5, "api_access": false}'), ('premium', 'Premium', 999, '{"max_alerts": 50, "max_watchlists": 20, "api_access": true}'), ('enterprise', 'Enterprise', 4999, '{"max_alerts": -1, "max_watchlists": -1, "api_access": true}') ON CONFLICT (name) DO NOTHING;

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    plan_id         INTEGER REFERENCES plans(id),
    status          TEXT DEFAULT 'ACTIVE',
    billing_cycle   TEXT DEFAULT 'MONTHLY',
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    auto_renew      BOOLEAN DEFAULT TRUE,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    amount          DECIMAL(10,2) NOT NULL,
    currency        TEXT DEFAULT 'INR',
    status          TEXT DEFAULT 'PENDING',
    payment_method  TEXT,
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    payment_id      INTEGER REFERENCES payments(id),
    invoice_number  TEXT UNIQUE NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    tax             DECIMAL(10,2) DEFAULT 0,
    total           DECIMAL(10,2) NOT NULL,
    status          TEXT DEFAULT 'DRAFT',
    due_date        DATE,
    paid_at         TIMESTAMPTZ,
    pdf_url         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

-- User Subscribers (New addition compatible with schema.prisma)
CREATE TABLE IF NOT EXISTS user_subscribers (
    id                 SERIAL PRIMARY KEY,
    chat_id            TEXT NOT NULL UNIQUE,
    username           TEXT,
    email              TEXT UNIQUE NOT NULL,
    subscribed_at      TIMESTAMPTZ DEFAULT NOW(),
    is_active          BOOLEAN DEFAULT TRUE,
    user_id            INTEGER REFERENCES users(id),
    is_verified        BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    preferences        JSONB DEFAULT '{}'
);

-- ============================================
-- 6. PERMISSIONS & VIEWS
-- ============================================

CREATE OR REPLACE VIEW latest_prices AS
SELECT DISTINCT ON (symbol) symbol, time, close as price, volume FROM candles_1m ORDER BY symbol, time DESC;

CREATE OR REPLACE VIEW daily_ohlc AS
SELECT symbol, first(open, time) as open, max(high) as high, min(low) as low, last(close, time) as close, sum(volume) as volume
FROM candles_1m WHERE time >= CURRENT_DATE GROUP BY symbol;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading;
