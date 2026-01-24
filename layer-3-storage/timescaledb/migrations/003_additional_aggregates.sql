-- ============================================
-- Continuous Aggregates Migration
-- Creates 10m, 30m, and weekly views
-- ============================================

-- ============================================
-- candles_10m (10-Minute Continuous Aggregate)
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_10m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('10 minutes', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('10 minutes', time), symbol, exchange
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_10m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '10 minutes',
    if_not_exists => TRUE
);

-- ============================================
-- candles_30m (30-Minute Continuous Aggregate)
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_30m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('30 minutes', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('30 minutes', time), symbol, exchange
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_30m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists => TRUE
);

-- ============================================
-- candles_weekly (Weekly Continuous Aggregate)
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_weekly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 week', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('1 week', time), symbol, exchange
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_weekly',
    start_offset => INTERVAL '2 weeks',
    end_offset => INTERVAL '1 week',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ============================================
-- Refresh existing data into new aggregates
-- ============================================
CALL refresh_continuous_aggregate('candles_10m', NULL, NULL);
CALL refresh_continuous_aggregate('candles_30m', NULL, NULL);
CALL refresh_continuous_aggregate('candles_weekly', NULL, NULL);

-- ============================================
-- Verification
-- ============================================
-- SELECT view_name FROM timescaledb_information.continuous_aggregates;
