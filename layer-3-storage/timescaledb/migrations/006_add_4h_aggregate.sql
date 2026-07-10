-- 006_add_4h_aggregate.sql
-- Adds candles_4h continuous aggregate (missing from L4 IntervalTableMap)

CREATE MATERIALIZED VIEW candles_4h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('4 hours', "time") AS bucket,
    symbol,
    FIRST(open, "time") AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, "time") AS close,
    SUM(volume) AS volume
FROM candles_1m
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_4h',
    start_offset    => INTERVAL '2 days',
    end_offset      => INTERVAL '4 hours',
    schedule_interval => INTERVAL '4 hours'
);
