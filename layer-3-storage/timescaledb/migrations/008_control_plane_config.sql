-- ============================================================================
-- 008_control_plane_config.sql
--
-- Move CONFIGURATION out of files/env and into the database, served by Layer 7.
-- One backend API; every layer reads its config from it.
--
-- What stays in .env (and can never move here — it is the root of trust):
--   DATABASE_URL / POSTGRES_PASSWORD  → opens this database
--   CREDENTIAL_MASTER_KEY             → decrypts broker_credentials
--   INTERNAL_API_KEY                  → authenticates callers to Layer 7, which fronts this DB
-- Anything required *to reach or decrypt the database* cannot live inside it. Everything else can.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. instrument_tokens — the broker symbol map (kills the file-based map)
--
-- The map lived in vendor/nifty50_shared.json with a silent fallback to
-- config/symbols.json, which holds KITE tokens. When the file failed to load, MStock was
-- handed Kite's token for RELIANCE (256265 instead of 2885): the socket connected, the
-- subscribe was accepted, and zero ticks ever arrived. A wrong source of truth is worse
-- than none. Tokens are per-(symbol, provider) — they are NOT interchangeable.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instrument_tokens (
  id          SERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,                    -- RELIANCE, NIFTY, BANKNIFTY, INDIAVIX
  provider    TEXT NOT NULL,                    -- mstock | kite | flattrade
  token       TEXT NOT NULL,                    -- broker-specific instrument token
  exchange    TEXT NOT NULL DEFAULT 'NSE',
  instrument_type TEXT NOT NULL DEFAULT 'EQ',   -- EQ | INDEX | FUT | OPT
  lot_size    INTEGER,
  tick_size   NUMERIC(10, 4),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, provider, exchange)
);
CREATE INDEX IF NOT EXISTS idx_instrument_tokens_provider ON instrument_tokens (provider, is_active);
COMMENT ON TABLE instrument_tokens IS
  'Per-broker instrument tokens. Never substitute one provider''s token for another — the feed will connect and silently deliver nothing.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. app_config — typed key/value runtime config (replaces scattered env flags)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  value_type  TEXT NOT NULL DEFAULT 'string',   -- string | number | boolean | json
  category    TEXT NOT NULL DEFAULT 'general',  -- ingestion | execution | ui | swarm ...
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);
COMMENT ON TABLE app_config IS 'Runtime configuration served by L7. Secrets do NOT belong here — see broker_credentials.';

INSERT INTO app_config (key, value, value_type, category, description) VALUES
  ('swarm.concurrency',        '4',       'number',  'swarm',     'Parallel workers for backfill'),
  ('backfill.max_range_days',  '30',      'number',  'ingestion', 'Max span of a single backfill request'),
  ('backfill.default_interval','"1m"',    'string',  'ingestion', 'Candle interval for historical backfill'),
  ('market.data_provider',     '"mstock"','string',  'ingestion', 'Preferred data provider (falls back to broker_providers registry)')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. risk_config — the risk envelope (replaces layer-10-execution/config/default.js)
--    Single active row; history retained for audit.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_config (
  id                     SERIAL PRIMARY KEY,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  max_lots               INTEGER NOT NULL DEFAULT 2,
  max_concurrent         INTEGER NOT NULL DEFAULT 1,
  max_trades_per_day     INTEGER NOT NULL DEFAULT 5,
  max_daily_loss         NUMERIC(12, 2) NOT NULL DEFAULT 2500.00,   -- ₹ — trips the kill switch
  max_risk_per_trade_pct NUMERIC(5, 2)  NOT NULL DEFAULT 2.00,
  stop_loss_pct          NUMERIC(5, 2)  NOT NULL DEFAULT 18.00,     -- premium
  target_pct             NUMERIC(5, 2)  NOT NULL DEFAULT 25.00,
  entry_cutoff           TIME NOT NULL DEFAULT '15:00',             -- IST
  square_off             TIME NOT NULL DEFAULT '15:15',             -- IST
  scalp_loss_budget      NUMERIC(12, 2) DEFAULT 2500.00,            -- separate budgets so one
  positional_loss_budget NUMERIC(12, 2) DEFAULT 2500.00,            -- profile cannot drain the other
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by             TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_config_active ON risk_config (is_active) WHERE is_active;
INSERT INTO risk_config (is_active) VALUES (TRUE) ON CONFLICT DO NOTHING;
COMMENT ON TABLE risk_config IS 'Live risk envelope. L10 hot-reloads on risk-changed; limits must never be loosened silently while positions are open.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. strategy_registry — pluggable strategies, params per REGIME bucket
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategy_registry (
  id              SERIAL PRIMARY KEY,
  strategy_id     TEXT NOT NULL,                     -- momentum-burst | trend-pullback
  version         TEXT NOT NULL DEFAULT 'v1',
  tier            TEXT NOT NULL,                     -- T1 | T2 | T3
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  mode            TEXT NOT NULL DEFAULT 'shadow',    -- shadow | live | retired
  regime_affinity TEXT[] NOT NULL DEFAULT '{}',      -- TREND_UP, TREND_DOWN, ...
  regime_bucket   TEXT NOT NULL DEFAULT 'DEFAULT',   -- params are tuned PER regime
  params          JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (strategy_id, version, regime_bucket)
);
COMMENT ON TABLE strategy_registry IS 'Strategy params are never hardcoded. Promotion to live is human-gated.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. alerts — the notification feed the dashboard reads (GET /api/v1/alerts)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id        BIGSERIAL,
  severity  TEXT NOT NULL DEFAULT 'info',   -- info | warn | error | critical
  source    TEXT NOT NULL DEFAULT 'system', -- execution | ingestion | broker | backfill
  message   TEXT NOT NULL,
  data      JSONB,
  read_at   TIMESTAMPTZ,
  PRIMARY KEY (time, id)
);
SELECT create_hypertable('alerts', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity, time DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. backtest_runs — results + the human-gated promotion state
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backtest_runs (
  id             SERIAL PRIMARY KEY,
  strategy_id    TEXT NOT NULL,
  regime_bucket  TEXT,
  params         JSONB NOT NULL DEFAULT '{}',
  from_date      DATE NOT NULL,
  to_date        DATE NOT NULL,
  trades         INTEGER,
  win_rate       NUMERIC(5, 2),
  profit_factor  NUMERIC(6, 3),
  expectancy_r   NUMERIC(6, 3),
  max_drawdown   NUMERIC(6, 2),
  net_of_costs   BOOLEAN NOT NULL DEFAULT FALSE,   -- a gross-of-costs result is not a result
  equity_curve   JSONB,
  promotion      TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN backtest_runs.net_of_costs IS 'STT + bid-ask + slippage + theta can erase a modest edge. Gross results are meaningless.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. prediction_log — every prediction + the outcome that later happened.
--    Required by the decay monitor; without it a model cannot be shown to still work.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_log (
  time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id              BIGSERIAL,
  underlying      TEXT NOT NULL,
  horizon         TEXT NOT NULL,               -- scalp | positional
  model_version   TEXT NOT NULL,
  direction       TEXT,                        -- UP | DOWN | FLAT | ABSTAIN
  probability     NUMERIC(5, 4),
  confidence      NUMERIC(5, 4),
  features        JSONB,
  actual_move_pct NUMERIC(8, 4),               -- filled in once the horizon elapses
  was_correct     BOOLEAN,
  PRIMARY KEY (time, id)
);
SELECT create_hypertable('prediction_log', 'time', if_not_exists => TRUE);
COMMENT ON COLUMN prediction_log.direction IS 'ABSTAIN is a first-class outcome — an untrained/stale model must never emit a fabricated number.';
