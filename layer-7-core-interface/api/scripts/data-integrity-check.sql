-- =============================================================================
-- DATA INTEGRITY VERIFICATION QUERIES
-- QA Automation: TimescaleDB Candle Data Validation
-- =============================================================================
-- Execute with: psql -U trading -d nifty50 -f scripts/data-integrity-check.sql
-- =============================================================================

\echo '============================================================'
\echo 'DATA INTEGRITY CHECK - Stock Analysis Database'
\echo '============================================================'

-- =============================================================================
-- 1. TABLE EXISTENCE & ROW COUNTS
-- =============================================================================
\echo ''
\echo '1. TABLE ROW COUNTS'
\echo '-------------------'

SELECT
    'candles_1m' as table_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT symbol) as symbols,
    MIN(time) as earliest,
    MAX(time) as latest
FROM candles_1m
UNION ALL
SELECT
    'candles_5m',
    COUNT(*),
    COUNT(DISTINCT symbol),
    MIN(time),
    MAX(time)
FROM candles_5m
UNION ALL
SELECT
    'candles_15m',
    COUNT(*),
    COUNT(DISTINCT symbol),
    MIN(time),
    MAX(time)
FROM candles_15m
UNION ALL
SELECT
    'candles_1h',
    COUNT(*),
    COUNT(DISTINCT symbol),
    MIN(time),
    MAX(time)
FROM candles_1h
UNION ALL
SELECT
    'candles_1d',
    COUNT(*),
    COUNT(DISTINCT symbol),
    MIN(time),
    MAX(time)
FROM candles_1d
UNION ALL
SELECT
    'candles_weekly',
    COUNT(*),
    COUNT(DISTINCT symbol),
    MIN(time),
    MAX(time)
FROM candles_weekly
ORDER BY table_name;

-- =============================================================================
-- 2. DATA FRESHNESS CHECK
-- =============================================================================
\echo ''
\echo '2. DATA FRESHNESS (Last Update by Symbol - Top 10)'
\echo '---------------------------------------------------'

SELECT
    symbol,
    MAX(time) as last_candle,
    NOW() - MAX(time) as data_age,
    CASE
        WHEN NOW() - MAX(time) < INTERVAL '1 hour' THEN 'FRESH'
        WHEN NOW() - MAX(time) < INTERVAL '1 day' THEN 'OK'
        ELSE 'STALE'
    END as status
FROM candles_1m
GROUP BY symbol
ORDER BY last_candle DESC
LIMIT 10;

-- =============================================================================
-- 3. DUPLICATE CHECK (Critical - ON CONFLICT DO NOTHING relies on this)
-- =============================================================================
\echo ''
\echo '3. DUPLICATE CHECK (should return 0 for all)'
\echo '---------------------------------------------'

SELECT
    'candles_1m' as table_name,
    COUNT(*) - COUNT(DISTINCT (time, symbol)) as duplicates
FROM candles_1m
UNION ALL
SELECT
    'candles_1d',
    COUNT(*) - COUNT(DISTINCT (time, symbol))
FROM candles_1d;

-- =============================================================================
-- 4. NULL VALUE CHECK (Critical fields should never be NULL)
-- =============================================================================
\echo ''
\echo '4. NULL VALUE CHECK'
\echo '-------------------'

SELECT
    'candles_1m' as table_name,
    SUM(CASE WHEN time IS NULL THEN 1 ELSE 0 END) as null_time,
    SUM(CASE WHEN symbol IS NULL THEN 1 ELSE 0 END) as null_symbol,
    SUM(CASE WHEN open IS NULL THEN 1 ELSE 0 END) as null_open,
    SUM(CASE WHEN high IS NULL THEN 1 ELSE 0 END) as null_high,
    SUM(CASE WHEN low IS NULL THEN 1 ELSE 0 END) as null_low,
    SUM(CASE WHEN close IS NULL THEN 1 ELSE 0 END) as null_close,
    SUM(CASE WHEN volume IS NULL THEN 1 ELSE 0 END) as null_volume
FROM candles_1m;

-- =============================================================================
-- 5. OHLC VALIDITY CHECK (high >= low, close/open within range)
-- =============================================================================
\echo ''
\echo '5. OHLC VALIDITY CHECK (Invalid candles - should be 0)'
\echo '------------------------------------------------------'

SELECT
    symbol,
    COUNT(*) as invalid_candles
FROM candles_1m
WHERE
    high < low
    OR open > high
    OR open < low
    OR close > high
    OR close < low
GROUP BY symbol
HAVING COUNT(*) > 0
ORDER BY invalid_candles DESC
LIMIT 10;

-- =============================================================================
-- 6. VOLUME SANITY CHECK (Negative or extremely high volumes)
-- =============================================================================
\echo ''
\echo '6. VOLUME ANOMALY CHECK'
\echo '-----------------------'

SELECT
    symbol,
    COUNT(*) as anomaly_count,
    MIN(volume) as min_volume,
    MAX(volume) as max_volume
FROM candles_1m
WHERE volume < 0 OR volume > 1000000000  -- 1 billion threshold
GROUP BY symbol
HAVING COUNT(*) > 0
ORDER BY anomaly_count DESC
LIMIT 10;

-- =============================================================================
-- 7. GAP DETECTION (Missing trading hours)
-- =============================================================================
\echo ''
\echo '7. DATA GAP DETECTION (Top 5 symbols with gaps in last 7 days)'
\echo '--------------------------------------------------------------'

WITH candle_gaps AS (
    SELECT
        symbol,
        time,
        LAG(time) OVER (PARTITION BY symbol ORDER BY time) as prev_time,
        time - LAG(time) OVER (PARTITION BY symbol ORDER BY time) as gap
    FROM candles_1m
    WHERE time > NOW() - INTERVAL '7 days'
        AND EXTRACT(HOUR FROM time) BETWEEN 9 AND 15  -- Market hours only
        AND EXTRACT(DOW FROM time) BETWEEN 1 AND 5    -- Weekdays only
)
SELECT
    symbol,
    COUNT(*) as gap_count,
    MAX(gap) as max_gap
FROM candle_gaps
WHERE gap > INTERVAL '5 minutes'  -- Expected 1m candles, allow 5m tolerance
GROUP BY symbol
ORDER BY gap_count DESC
LIMIT 5;

-- =============================================================================
-- 8. CONTINUOUS AGGREGATE CONSISTENCY
-- =============================================================================
\echo ''
\echo '8. CONTINUOUS AGGREGATE CONSISTENCY (15m vs 1m aggregation)'
\echo '-----------------------------------------------------------'

WITH manual_15m AS (
    SELECT
        time_bucket('15 minutes', time) as bucket,
        symbol,
        first(open, time) as open,
        max(high) as high,
        min(low) as low,
        last(close, time) as close,
        sum(volume) as volume
    FROM candles_1m
    WHERE symbol = 'RELIANCE'
        AND time > NOW() - INTERVAL '1 day'
    GROUP BY bucket, symbol
)
SELECT
    m.bucket,
    m.symbol,
    ABS(m.close - c.close) as close_diff,
    ABS(m.volume - c.volume) as volume_diff
FROM manual_15m m
JOIN candles_15m c ON m.bucket = c.time AND m.symbol = c.symbol
WHERE ABS(m.close - c.close) > 0.01 OR ABS(m.volume - c.volume) > 100
LIMIT 10;

-- =============================================================================
-- 9. SYMBOL COVERAGE (Nifty 50 completeness)
-- =============================================================================
\echo ''
\echo '9. SYMBOL COVERAGE (Distinct symbols per table)'
\echo '-----------------------------------------------'

SELECT
    'candles_1m' as table_name,
    COUNT(DISTINCT symbol) as symbol_count,
    STRING_AGG(DISTINCT symbol, ', ' ORDER BY symbol) as sample_symbols
FROM candles_1m
WHERE time > NOW() - INTERVAL '1 day'
UNION ALL
SELECT
    'candles_1d',
    COUNT(DISTINCT symbol),
    STRING_AGG(DISTINCT symbol, ', ' ORDER BY symbol)
FROM candles_1d
WHERE time > NOW() - INTERVAL '30 days';

-- =============================================================================
-- 10. INDEX HEALTH CHECK
-- =============================================================================
\echo ''
\echo '10. INDEX HEALTH CHECK'
\echo '----------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename LIKE 'candles%'
ORDER BY tablename, indexname;

-- =============================================================================
-- 11. COMPRESSION STATUS (TimescaleDB)
-- =============================================================================
\echo ''
\echo '11. COMPRESSION STATUS'
\echo '----------------------'

SELECT
    hypertable_name,
    total_chunks,
    number_compressed_chunks,
    pg_size_pretty(before_compression_total_bytes) as before_compression,
    pg_size_pretty(after_compression_total_bytes) as after_compression,
    ROUND(100.0 * (1 - after_compression_total_bytes::numeric / NULLIF(before_compression_total_bytes, 0)), 1) as compression_ratio
FROM timescaledb_information.compression_stats
ORDER BY hypertable_name;

-- =============================================================================
-- 12. PRICE RANGE SANITY (Detect extreme outliers)
-- =============================================================================
\echo ''
\echo '12. PRICE OUTLIER CHECK (Prices outside 3 std dev)'
\echo '---------------------------------------------------'

WITH price_stats AS (
    SELECT
        symbol,
        AVG(close) as avg_price,
        STDDEV(close) as std_price
    FROM candles_1d
    WHERE time > NOW() - INTERVAL '90 days'
    GROUP BY symbol
)
SELECT
    c.symbol,
    c.time,
    c.close,
    p.avg_price,
    (c.close - p.avg_price) / NULLIF(p.std_price, 0) as z_score
FROM candles_1d c
JOIN price_stats p ON c.symbol = p.symbol
WHERE ABS(c.close - p.avg_price) > 3 * p.std_price
    AND c.time > NOW() - INTERVAL '30 days'
ORDER BY ABS((c.close - p.avg_price) / NULLIF(p.std_price, 0)) DESC
LIMIT 10;

-- =============================================================================
-- 13. DATA COMPLETENESS SCORE
-- =============================================================================
\echo ''
\echo '13. OVERALL DATA QUALITY SCORE'
\echo '------------------------------'

WITH metrics AS (
    SELECT
        (SELECT COUNT(*) FROM candles_1m WHERE time > NOW() - INTERVAL '1 day') as recent_candles,
        (SELECT COUNT(DISTINCT symbol) FROM candles_1m WHERE time > NOW() - INTERVAL '1 day') as active_symbols,
        (SELECT COUNT(*) FROM candles_1m WHERE high < low) as invalid_ohlc,
        (SELECT COUNT(*) FROM candles_1m WHERE volume < 0) as invalid_volume
)
SELECT
    recent_candles,
    active_symbols,
    CASE
        WHEN recent_candles > 10000 AND active_symbols >= 40 THEN 'EXCELLENT'
        WHEN recent_candles > 5000 AND active_symbols >= 30 THEN 'GOOD'
        WHEN recent_candles > 1000 AND active_symbols >= 20 THEN 'FAIR'
        ELSE 'POOR'
    END as data_coverage,
    CASE
        WHEN invalid_ohlc = 0 AND invalid_volume = 0 THEN 'CLEAN'
        WHEN invalid_ohlc < 10 AND invalid_volume < 10 THEN 'ACCEPTABLE'
        ELSE 'NEEDS_ATTENTION'
    END as data_quality
FROM metrics;

\echo ''
\echo '============================================================'
\echo 'DATA INTEGRITY CHECK COMPLETE'
\echo '============================================================'
