-- 007_history_retention_and_index_membership.sql
--
-- Two fixes that the "5 years of pattern data" vision cannot exist without.
--
-- 1. RETENTION. 001_init_schema.sql set `add_retention_policy('candles_1m', 30 days)`.
--    That silently deletes every 1-minute candle older than a month. You cannot mine
--    five years of history from thirty days of data, and DATABASE_SCHEMA.md claimed
--    "1 year hot, 10 years compressed" the whole time. This raises base retention to
--    5 years; compression at 7 days (from 001) keeps the cost of that small.
--
-- 2. SURVIVORSHIP BIAS. `instruments.is_nifty50` is a CURRENT-STATE boolean. Backtesting
--    "stock vs NIFTY-50" with it uses TODAY's 50 names for ALL of history — excluding every
--    company that was dropped (the losers) and including every addition only after it had
--    already run up. That manufactures alpha that never existed. This adds a point-in-time
--    membership table: which symbols were in which index on any given date.
--
-- Idempotent (safe to re-run); applied in filename order by `make db-reset` / db-migrate.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Base candle retention: 30 days → 5 years
-- ─────────────────────────────────────────────────────────────────────────────
-- `add_retention_policy(... if_not_exists => TRUE)` will NOT change an existing policy's
-- interval, so the old 30-day policy must be removed before the new one is added.
SELECT remove_retention_policy('candles_1m', if_exists => TRUE);
SELECT add_retention_policy('candles_1m', INTERVAL '1825 days', if_not_exists => TRUE);

-- Continuous aggregates (candles_5m/15m/30m/1h/4h/1d/weekly) carry NO retention policy,
-- so they already persist indefinitely. Daily candles are the long-horizon backtest spine;
-- leave them uncapped on purpose.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Point-in-time index membership (kills survivorship bias)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS index_membership (
    index_name  TEXT NOT NULL,        -- 'NIFTY50', 'NIFTYBANK', 'NIFTY500', ...
    symbol      TEXT NOT NULL,        -- constituent, matches instruments.symbol
    valid_from  DATE NOT NULL,        -- inclusive: first day the symbol was a member
    valid_to    DATE,                 -- inclusive last day; NULL = still a member today
    weight      DECIMAL(7,4),         -- index weight (%) at valid_from, if known — else NULL
    reason      TEXT,                 -- 'inclusion' | 'exclusion' | 'reconstitution'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (index_name, symbol, valid_from),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

COMMENT ON TABLE index_membership IS
  'Point-in-time index constituents. A symbol dropped from an index keeps its row with '
  'valid_to set — that is precisely the survivorship-bias fix. NEVER derive historical '
  'membership from instruments.is_nifty50 (current-state only). This table is intentionally '
  'left EMPTY by the migration: it must be loaded from a real NSE historical-constituents '
  'source. An empty table returns zero members for a past date (a visible, correct absence), '
  'never a fabricated "today''s 50 for all of history".';

-- Point-in-time lookup index: "who was in index X on date D".
CREATE INDEX IF NOT EXISTS idx_index_membership_asof
    ON index_membership (index_name, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_index_membership_symbol
    ON index_membership (symbol);

-- Helper: constituents of an index as of a given date. Backtests MUST call this rather than
-- reading instruments.is_nifty50, or they reintroduce the bias this table exists to remove.
CREATE OR REPLACE FUNCTION index_members_asof(p_index TEXT, p_asof DATE)
RETURNS TABLE (symbol TEXT, weight DECIMAL) AS $$
    SELECT m.symbol, m.weight
    FROM index_membership m
    WHERE m.index_name = p_index
      AND m.valid_from <= p_asof
      AND (m.valid_to IS NULL OR m.valid_to >= p_asof);
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION index_members_asof(TEXT, DATE) IS
  'Point-in-time index constituents on p_asof. Use in every historical stock-vs-index '
  'comparison. Returns 0 rows until index_membership is loaded — that is correct, not a bug.';
