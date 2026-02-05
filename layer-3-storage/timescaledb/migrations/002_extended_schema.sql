-- ============================================
-- Nifty 50 Trading System - Database Schema v2
-- Layer 3: Storage Layer - TimescaleDB
-- Migration: 002_extended_schema.sql
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SCHEMA: market (Time-Series Data)
-- ============================================

-- Add unique constraint to existing candles_1m for duplicate prevention
ALTER TABLE candles_1m ADD CONSTRAINT unique_candle_1m 
    UNIQUE (time, symbol);

-- ============================================
-- NEW: candles_1h (Hourly Continuous Aggregate)
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('1 hour', time), symbol, exchange
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1h',
    start_offset => INTERVAL '4 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- ============================================
-- NEW: candles_1d (Daily Continuous Aggregate)
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1d
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('1 day', time), symbol, exchange
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1d',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);


-- ============================================
-- SCHEMA: reference (Master Data)
-- ============================================

-- Sectors (create first due to foreign key)
CREATE TABLE IF NOT EXISTS sectors (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    display_name    TEXT,
    description     TEXT,
    weight          DECIMAL(5,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed sectors
INSERT INTO sectors (name, display_name) VALUES
    ('IT', 'Information Technology'),
    ('BANKING', 'Banking & Financial Services'),
    ('AUTO', 'Automobile'),
    ('PHARMA', 'Pharmaceuticals'),
    ('FMCG', 'Fast Moving Consumer Goods'),
    ('ENERGY', 'Oil & Gas'),
    ('METALS', 'Metals & Mining'),
    ('REALTY', 'Real Estate'),
    ('TELECOM', 'Telecommunications'),
    ('INFRA', 'Infrastructure')
ON CONFLICT (name) DO NOTHING;

-- Instruments (Stock Master)
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


-- ============================================
-- SCHEMA: app (User Data)
-- ============================================

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

-- Enhance existing user_subscribers if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_subscribers') THEN
        ALTER TABLE user_subscribers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
        ALTER TABLE user_subscribers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE user_subscribers ADD COLUMN IF NOT EXISTS verification_token TEXT;
        ALTER TABLE user_subscribers ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
    END IF;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_user_alerts_symbol ON user_alerts(symbol);

-- User Watchlists
CREATE TABLE IF NOT EXISTS user_watchlists (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    name            TEXT NOT NULL,
    symbols         TEXT[] NOT NULL,
    is_default      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- SCHEMA: system (Metadata)
-- ============================================

-- Data Availability (Watermark System)
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
    
    UNIQUE(symbol, timeframe)
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

-- Seed config
INSERT INTO system_config (key, value, description) VALUES
    ('data_retention_days', '{"ticks": 30, "candles_1m": 365, "candles_1d": 3650}', 'Data retention by timeframe'),
    ('compression_delay_hours', '{"ticks": 24, "candles_1m": 168}', 'Hours before compression'),
    ('nifty50_last_updated', '"2026-01-21"', 'Last Nifty 50 constituent update')
ON CONFLICT (key) DO NOTHING;

-- Audit Log (Hypertable)
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

SELECT create_hypertable('audit_log', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

SELECT add_retention_policy('audit_log', INTERVAL '90 days', if_not_exists => TRUE);


-- ============================================
-- SCHEMA: analysis (Cached Indicators)
-- ============================================

-- Technical Indicators Cache
CREATE TABLE IF NOT EXISTS technical_indicators (
    time            TIMESTAMPTZ NOT NULL,
    symbol          TEXT NOT NULL,
    timeframe       TEXT NOT NULL,
    
    -- Trend
    ema_9           DECIMAL(12,2),
    ema_21          DECIMAL(12,2),
    ema_50          DECIMAL(12,2),
    ema_200         DECIMAL(12,2),
    sma_20          DECIMAL(12,2),
    
    -- Momentum
    rsi_14          DECIMAL(8,4),
    macd            DECIMAL(12,4),
    macd_signal     DECIMAL(12,4),
    macd_histogram  DECIMAL(12,4),
    
    -- Volatility
    atr_14          DECIMAL(12,4),
    bb_upper        DECIMAL(12,2),
    bb_middle       DECIMAL(12,2),
    bb_lower        DECIMAL(12,2),
    
    -- Volume
    vwap            DECIMAL(12,2),
    obv             BIGINT,
    
    -- Composite
    trend_score     DECIMAL(5,4),
    momentum_score  DECIMAL(5,4),
    volatility_score DECIMAL(5,4)
);

SELECT create_hypertable('technical_indicators', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_tech_indicators_symbol_tf 
    ON technical_indicators(symbol, timeframe, time DESC);


-- ============================================
-- SCHEMA: billing (Future - Payments)
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

-- Seed plans
INSERT INTO plans (name, display_name, price_monthly, features) VALUES
    ('free', 'Free Tier', 0, '{"max_alerts": 3, "max_watchlists": 1, "api_access": false}'),
    ('basic', 'Basic', 299, '{"max_alerts": 10, "max_watchlists": 5, "api_access": false}'),
    ('premium', 'Premium', 999, '{"max_alerts": 50, "max_watchlists": 20, "api_access": true}'),
    ('enterprise', 'Enterprise', 4999, '{"max_alerts": -1, "max_watchlists": -1, "api_access": true}')
ON CONFLICT (name) DO NOTHING;

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


-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify:
-- SELECT hypertable_name FROM timescaledb_information.hypertables;
-- SELECT view_name FROM timescaledb_information.continuous_aggregates;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
