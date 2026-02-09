# Database Implementation v2 — Plan

## Problem Statement

1. **Silent Data Loss**: A 30-day retention policy on `candles_1m` has been automatically deleting historical data. The `system_config` says 365 days, but the actual TimescaleDB policy enforces 30 days.
2. **No Reliable Backup**: The current 418K rows need to be dumped and preserved before any changes.
3. **Scalability Concern**: Can TimescaleDB handle 10 years of Nifty 50 1-minute data (~47M rows)?
4. **Missing Views/Aggregates**: `candles_4h` aggregate is missing. Views (`daily_ohlc`, `latest_prices`) exist but aren't in Prisma.
5. **Missing Unique Constraints**: Several tables lack uniqueness guarantees — allows silent duplicate inserts.
6. **Resource Allocation**: Current 4 CPU / 8 GB limit is conservative for 10-year data handling.
7. **Schema Sprawl**: Market data and app data mixed in one flat namespace.

---

## Data Volume Math (Exact)

| Metric | Value |
|--------|-------|
| Stocks | 50 (Nifty 50) |
| Market hours | 9:15 AM — 3:30 PM IST = 375 minutes |
| Candles per stock per day | 375 |
| Trading days per month | ~21 |
| Trading days per year | ~252 |
| **Rows per day** | **18,750** |
| Rows per month | ~393,750 |
| **Rows per year** | **~4,725,000** (~47 lakh) |
| **Rows in 10 years** | **~47,250,000** (~4.7 crore) |
| Row size (candles_1m) | ~120 bytes |
| **10-year raw size** | **~5.4 GB** |
| 10-year with compression (10-20x) | **~500 MB — 1 GB** |
| 10-year with indexes | **~3-5 GB total on disk** |

### All Tables Combined (10-Year Estimate)

| Table | Rows/Year | 10Y Total | Compressed Size |
|-------|-----------|-----------|-----------------|
| candles_1m | 4.7M | 47M | ~500 MB |
| candles_5m (aggregate) | 945K | 9.5M | ~50 MB |
| candles_10m (aggregate) | 472K | 4.7M | ~25 MB |
| candles_15m (aggregate) | 315K | 3.2M | ~18 MB |
| candles_30m (aggregate) | 157K | 1.6M | ~10 MB |
| candles_1h (aggregate) | 88K | 882K | ~5 MB |
| candles_4h (aggregate) | 25K | 252K | ~2 MB |
| candles_1d (aggregate) | 12.6K | 126K | ~1 MB |
| candles_weekly (aggregate) | 2.6K | 26K | <1 MB |
| technical_indicators | ~1M | ~10M | ~100 MB |
| signals | ~10K | ~100K | ~5 MB |
| options_chain | variable | ~5-20M | ~100-500 MB |
| **TOTAL** | | **~80-100M** | **~1-2 GB** |

**Verdict**: 10 years of ALL data fits in **~5 GB on disk** (with compression + indexes). On a 1 TB drive, this is 0.5% of capacity. TimescaleDB handles this trivially — production deployments handle billions of rows.

---

## Part 1: Immediate Fix — Save Current Data (P0)

### Step 1: Backup current data

```bash
make backup
```

### Step 2: Remove the destructive retention policy (LIVE DATABASE)

```sql
-- Run this NOW on the running database
SELECT remove_retention_policy('candles_1m');
```

### Step 3: Update init.sql to prevent re-creation on fresh deploys

```sql
-- Line 43: REMOVE this line entirely
-- OLD: SELECT add_retention_policy('candles_1m', INTERVAL '30 days', if_not_exists => TRUE);
-- REPLACED WITH: (nothing — no retention on raw candle data)
```

---

## Part 2: Continuous Aggregates & Views (Complete Set)

### Required Timeframes

All timeframes as continuous aggregates on `candles_1m`:

| Timeframe | Exists? | Compression | Action |
|-----------|---------|-------------|--------|
| candles_5m | Yes | No | Add compression policy |
| candles_10m | Yes | No | Keep + add compression |
| candles_15m | Yes | No | Add compression policy |
| candles_30m | Yes | No | Keep + add compression |
| candles_1h | Yes | No | Add compression policy |
| **candles_4h** | **No** | — | **CREATE** |
| candles_1d | Yes | No | Add compression policy |
| candles_weekly | Yes | No | Add compression policy |

### New: candles_4h Aggregate

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_4h WITH (timescaledb.continuous) AS
SELECT time_bucket('4 hours', time) AS time, symbol, exchange,
  first(open, time) AS open, max(high) AS high,
  min(low) AS low, last(close, time) AS close,
  sum(volume) AS volume,
  sum(volume * vwap) / NULLIF(sum(volume), 0) AS vwap,
  sum(trades) AS trades
FROM candles_1m
GROUP BY time_bucket('4 hours', time), symbol, exchange
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_4h',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '4 hours',
  schedule_interval => INTERVAL '4 hours',
  if_not_exists => TRUE
);
```

### Compression on ALL Continuous Aggregates

```sql
ALTER MATERIALIZED VIEW candles_5m SET (timescaledb.compress);
SELECT add_compression_policy('candles_5m', INTERVAL '30 days', if_not_exists => TRUE);

ALTER MATERIALIZED VIEW candles_10m SET (timescaledb.compress);
SELECT add_compression_policy('candles_10m', INTERVAL '30 days', if_not_exists => TRUE);

ALTER MATERIALIZED VIEW candles_15m SET (timescaledb.compress);
SELECT add_compression_policy('candles_15m', INTERVAL '30 days', if_not_exists => TRUE);

ALTER MATERIALIZED VIEW candles_30m SET (timescaledb.compress);
SELECT add_compression_policy('candles_30m', INTERVAL '30 days', if_not_exists => TRUE);

ALTER MATERIALIZED VIEW candles_1h SET (timescaledb.compress);
SELECT add_compression_policy('candles_1h', INTERVAL '60 days', if_not_exists => TRUE);

ALTER MATERIALIZED VIEW candles_4h SET (timescaledb.compress);
SELECT add_compression_policy('candles_4h', INTERVAL '60 days', if_not_exists => TRUE);

ALTER MATERIALIZED VIEW candles_1d SET (timescaledb.compress);
SELECT add_compression_policy('candles_1d', INTERVAL '90 days', if_not_exists => TRUE);

ALTER MATERIALIZED VIEW candles_weekly SET (timescaledb.compress);
SELECT add_compression_policy('candles_weekly', INTERVAL '90 days', if_not_exists => TRUE);
```

### Views (Already Exist — Keep)

```sql
-- latest_prices: DISTINCT ON per symbol, latest close + volume
CREATE OR REPLACE VIEW latest_prices AS
SELECT DISTINCT ON (symbol) symbol, time, close as price, volume
FROM candles_1m ORDER BY symbol, time DESC;

-- daily_ohlc: Today's aggregated OHLC per symbol
CREATE OR REPLACE VIEW daily_ohlc AS
SELECT symbol,
  first(open, time) as open, max(high) as high,
  min(low) as low, last(close, time) as close,
  sum(volume) as volume
FROM candles_1m WHERE time >= CURRENT_DATE GROUP BY symbol;
```

These views already exist in init.sql (lines 440-445). They work correctly.

---

## Part 3: Unique Constraints Audit

### Current State — Tables Missing Uniqueness

| Table | Has Unique? | Missing Constraint | Risk |
|-------|-------------|-------------------|------|
| `candles_1m` | `UNIQUE(time, symbol)` | None | Safe |
| `options_chain` | `@@id([time, symbol, expiry, strike, option_type])` | None (composite PK is unique) | Safe |
| `signals` | `@@id([time, id])` | No business uniqueness | Duplicate signals possible |
| `market_breadth` | `@@id([time])` | None | Safe |
| `sector_strength` | `@@id([time, sector])` | None | Safe |
| `technical_indicators` | `@@id([time, symbol, timeframe])` | None | Safe |
| `instruments` | `UNIQUE(symbol)` | None | Safe |
| `sectors` | `UNIQUE(name)` | None | Safe |
| `trading_calendar` | `PRIMARY KEY(date)` | None | Safe |
| `data_availability` | `UNIQUE(symbol)` | None | Safe |
| `system_config` | `PRIMARY KEY(key)` | None | Safe |
| `api_keys` | `UNIQUE(key)` | None | Safe |
| `users` | `UNIQUE(telegram_id)` | `email` should be unique | Duplicate emails possible |
| `user_subscribers` | `UNIQUE(chat_id)`, `UNIQUE(email)` | None | Safe |
| `invoices` | `UNIQUE(invoice_number)` | None | Safe |
| `plans` | `UNIQUE(name)` | None | Safe |
| `backfill_jobs` | None beyond PK | `UNIQUE(job_id)` needed | Duplicate UUIDs theoretically possible |
| `subscriptions` | None beyond PK | `UNIQUE(user_id, plan_id, status)` for active subs | User can have multiple active subs for same plan |
| `payments` | None beyond PK | `UNIQUE(gateway_payment_id)` when not null | Duplicate gateway payments possible |
| `user_watchlists` | None beyond PK | `UNIQUE(user_id, name)` | User can create duplicate-named watchlists |
| `user_alerts` | None beyond PK | `UNIQUE(user_id, symbol, alert_type, condition, threshold)` | Exact duplicate alerts possible |
| `system_notifications` | None beyond PK | None needed (append-only log) | OK |
| `audit_log` | None beyond PK | None needed (append-only log) | OK |
| `backup_logs` | None beyond PK | None needed (append-only log) | OK |

### SQL to Add Missing Constraints

```sql
-- 1. users: email should be unique (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email) WHERE email IS NOT NULL;

-- 2. backfill_jobs: job_id must be unique
ALTER TABLE backfill_jobs ADD CONSTRAINT unique_backfill_job_id UNIQUE (job_id);

-- 3. payments: gateway_payment_id should be unique when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_unique
  ON payments(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

-- 4. user_watchlists: no duplicate names per user
ALTER TABLE user_watchlists ADD CONSTRAINT unique_user_watchlist_name
  UNIQUE (user_id, name);

-- 5. user_alerts: prevent exact duplicate alerts
ALTER TABLE user_alerts ADD CONSTRAINT unique_user_alert
  UNIQUE (user_id, symbol, alert_type, condition, threshold);

-- 6. subscriptions: one active subscription per user per plan
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_unique
  ON subscriptions(user_id, plan_id) WHERE status = 'ACTIVE';
```

### Prisma Schema Updates (Corresponding)

```prisma
model users {
  // ... existing fields
  @@unique([email], map: "idx_users_email_unique")  // Add
}

model backfill_jobs {
  // ... existing fields
  job_id String? @unique @default(dbgenerated("gen_random_uuid()")) @db.Uuid  // Add @unique
}

model payments {
  // ... existing fields
  gateway_payment_id String? @unique  // Add @unique
}

model user_watchlists {
  // ... existing fields
  @@unique([user_id, name], map: "unique_user_watchlist_name")  // Add
}

model user_alerts {
  // ... existing fields
  @@unique([user_id, symbol, alert_type, condition, threshold], map: "unique_user_alert")  // Add
}
```

---

## Part 4: Prisma Schema — Add Continuous Aggregate Models

Prisma needs model definitions for ALL continuous aggregates so Layer 7 can query them via ORM.

### New Models to Add to schema.prisma

```prisma
/// Continuous aggregate: 5-minute candles (auto-maintained by TimescaleDB)
model candles_5m {
  time     DateTime  @db.Timestamptz(6)
  symbol   String
  exchange String?
  open     Decimal   @db.Decimal(12, 2)
  high     Decimal   @db.Decimal(12, 2)
  low      Decimal   @db.Decimal(12, 2)
  close    Decimal   @db.Decimal(12, 2)
  volume   BigInt?
  vwap     Decimal?  @db.Decimal(12, 2)
  trades   BigInt?

  @@id([time, symbol])
  @@index([symbol, time(sort: Desc)])
  @@map("candles_5m")
}

/// Repeat for: candles_10m, candles_15m, candles_30m, candles_1h, candles_4h, candles_1d, candles_weekly
/// (Same shape — only model name and @@map change)
```

**Note**: Prisma treats continuous aggregates as regular tables for READ operations. All writes go through `candles_1m` only — the aggregates are auto-populated by TimescaleDB.

---

## Part 5: Resource Allocation (Increased for 10-Year Scale)

### Current vs Recommended

| Parameter | Current | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| **CPU limit** | 4.0 | **6.0** | More parallel workers for 47M row aggregations |
| **CPU reservation** | 2.0 | **3.0** | Guarantee cores for background compression + aggregation |
| **Memory limit** | 8 GB | **12 GB** | Room for shared_buffers + work_mem under load |
| **Memory reservation** | 4 GB | **6 GB** | Guarantee for steady-state operations |
| **shm_size** | 10 GB | **12 GB** | Match memory limit for shared memory |

### Updated docker-compose.resources.yml

```yaml
timescaledb:
  deploy:
    resources:
      limits:
        cpus: '6.0'
        memory: 12G
      reservations:
        cpus: '3.0'
        memory: 6G
```

### Updated PostgreSQL Tuning (docker-compose.infra.yml)

| Parameter | Current | Recommended | Reason |
|-----------|---------|-------------|--------|
| `shared_buffers` | 6 GB | **8 GB** | ~66% of 12 GB limit; caches entire 10Y dataset |
| `effective_cache_size` | 14 GB | **10 GB** | Realistic for container memory limit |
| `work_mem` | 512 MB (dangerous) | **128 MB** | Safe: 128MB × 4 workers × 10 queries = 5 GB peak |
| `maintenance_work_mem` | 4 GB | **2 GB** | Sufficient for index builds on 47M rows |
| `max_wal_size` | 8 GB | 8 GB | Keep (good for batch ingestion) |
| `wal_buffers` | 64 MB | 64 MB | Keep |
| `max_connections` | 200 | 200 | Keep |
| `max_worker_processes` | 8 | 8 | Keep |
| `max_parallel_workers_per_gather` | 4 | 4 | Keep |
| `synchronous_commit` | off | **on** | Safer for 10-year data persistence |
| `commit_delay` | 100000 | **10000** | Less aggressive grouping, safer |

**Critical fix**: Remove the duplicate `work_mem=512MB` on line 182 of docker-compose.infra.yml. PostgreSQL uses the LAST `-c` value, so 512 MB overrides 256 MB silently.

---

## Part 6: Chunk Interval Optimization

### Change from 1 day to 1 week

| Metric | 1 day (current) | 1 week (recommended) |
|--------|-----------------|---------------------|
| Rows per chunk | 18,750 | 131,250 |
| Chunk size (raw) | ~2 MB | ~15 MB |
| Chunks in 10 years | 2,520 | 520 |
| Query planner overhead | High (>2000 chunks) | Low (~500 chunks) |
| Compression effectiveness | Poor (tiny segments) | Good (larger segments) |

```sql
-- Apply to live database (only affects NEW chunks)
SELECT set_chunk_time_interval('candles_1m', INTERVAL '1 week');
```

### Update in init.sql for fresh deploys

```sql
SELECT create_hypertable('candles_1m', 'time',
    chunk_time_interval => INTERVAL '1 week',  -- Changed from '1 day'
    if_not_exists => TRUE
);
```

---

## Part 7: Compression Configuration Fix

### Add explicit orderby

```sql
ALTER TABLE candles_1m SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol',
  timescaledb.compress_orderby = 'time DESC'
);

-- Keep compression policy at 7 days
SELECT add_compression_policy('candles_1m', INTERVAL '7 days', if_not_exists => TRUE);
```

---

## Part 8: Redundant Index Cleanup

### candles_1m currently has 4 overlapping indexes

| # | Index | Purpose | Keep? |
|---|-------|---------|-------|
| 1 | `UNIQUE(time, symbol)` | Duplicate prevention (ON CONFLICT) | **Keep** |
| 2 | `idx_candles_1m_symbol_time(symbol, time DESC)` | Query performance | **Keep** |
| 3 | `unique_candle_per_minute(symbol, time)` (Prisma) | Duplicate of #1 reversed | **Remove** |
| 4 | Implicit TimescaleDB time index | Chunk exclusion | Auto-managed |

### Remove from Prisma schema

```diff
model candles_1m {
  // ...
  @@id([time, symbol])
- @@unique([symbol, time], map: "unique_candle_per_minute")
  @@index([time(sort: Desc)])
  @@index([symbol, time(sort: Desc)], map: "idx_candles_1m_symbol_time")
}
```

### Remove from live database

```sql
ALTER TABLE candles_1m DROP CONSTRAINT IF EXISTS unique_candle_per_minute;
```

---

## Part 9: Backup Strategy for 10 Years of Data

### Dump Size Estimates

| Data Volume | pg_dump -Fc Size | Time to Dump | Time to Restore |
|-------------|-----------------|--------------|-----------------|
| 1 year (4.7M rows) | ~100-200 MB | ~10 seconds | ~30 seconds |
| 5 years (23.5M rows) | ~500 MB - 1 GB | ~30 seconds | ~2 minutes |
| 10 years (47M rows) | ~1-2 GB | ~1 minute | ~5 minutes |

On a 1 TB drive, even uncompressed dumps are trivial.

### Backup Tiers

| Tier | Frequency | Method | Retention |
|------|-----------|--------|-----------|
| **Daily** | 00:00 IST | `pg_dump -Fc` full DB | Keep 7 daily |
| **Weekly** | Sunday | `pg_dump -Fc` full + gzip | Keep 4 weekly |
| **Monthly Archive** | 1st of month | CSV export per month | Keep forever |
| **Pre-Migration** | Before any schema change | `pg_dump -Fc` full | Keep until verified |

### Monthly CSV Archive (Portable, Database-Agnostic)

```bash
# Export one month of candle data as CSV (~50 MB uncompressed, ~5 MB gzipped)
docker exec timescaledb psql -U trading -d nifty50 -c \
  "\copy (SELECT * FROM candles_1m WHERE time >= '2026-01-01' AND time < '2026-02-01' ORDER BY time, symbol) TO STDOUT WITH CSV HEADER" \
  > backups/archive/candles_1m_2026_01.csv

# Compress
gzip backups/archive/candles_1m_2026_01.csv
```

10 years of monthly CSVs = 120 files × ~5 MB = **~600 MB total**. Import into any database (PostgreSQL, MySQL, SQLite, Python pandas).

### Full 10-Year Dump

```bash
# Complete database dump — works on any data size
docker exec timescaledb pg_dump -U trading -Fc -Z 6 nifty50 > backups/nifty50_full_10yr.dump

# Verify dump integrity
pg_restore --list backups/nifty50_full_10yr.dump | head -20

# Restore (nuclear: drop + recreate)
docker exec timescaledb dropdb -U trading --if-exists nifty50
docker exec timescaledb createdb -U trading nifty50
docker exec timescaledb psql -U trading -d nifty50 -c \
  "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE; SELECT timescaledb_pre_restore();"
docker exec -i timescaledb pg_restore -U trading -d nifty50 --no-owner --no-privileges \
  < backups/nifty50_full_10yr.dump
docker exec timescaledb psql -U trading -d nifty50 -c "SELECT timescaledb_post_restore();"
```

---

## Part 10: Schema Separation (Phase 2)

### Recommended PostgreSQL Schemas

```
nifty50 (database)
├── market.*          # Time-series (hypertables + continuous aggregates)
│   ├── candles_1m, candles_5m ... candles_weekly
│   ├── options_chain, signals, technical_indicators
│   ├── market_breadth, sector_strength
│   └── Views: latest_prices, daily_ohlc
│
├── master.*          # Reference data (slow-changing)
│   ├── instruments, sectors, trading_calendar
│
├── app.*             # User-facing data
│   ├── users, user_alerts, user_watchlists, user_subscribers
│   ├── api_keys, system_notifications
│
├── billing.*         # Financial data
│   ├── plans, subscriptions, payments, invoices
│
└── ops.*             # Operational data
    ├── system_config, backfill_jobs, data_availability
    ├── audit_log, backup_logs
```

**Benefits**: Selective backups (`pg_dump -n market`), access control, clear ownership.

**Migration**: Phase 2 — requires updating all raw SQL in Layer 1, 2, 4, 5 and Prisma `@@schema()` annotations.

---

## Execution Plan — Priority Order

### Phase 1: Critical Fixes (Do Now)

| Step | Action | Files Changed |
|------|--------|---------------|
| 1.1 | `make backup` — save current data | — |
| 1.2 | Remove 30-day retention policy (live DB) | Run SQL |
| 1.3 | Update init.sql: remove retention, chunk → 1 week, explicit compress_orderby | `init.sql` |
| 1.4 | Fix work_mem: remove duplicate 512 MB, set 128 MB | `docker-compose.infra.yml` |
| 1.5 | Increase DB resources: 6 CPU / 12 GB | `docker-compose.resources.yml` |
| 1.6 | Set `synchronous_commit=on` for data safety | `docker-compose.infra.yml` |

### Phase 1B: Add Missing Features

| Step | Action | Files Changed |
|------|--------|---------------|
| 1.7 | Create `candles_4h` continuous aggregate | `init.sql` + live DB |
| 1.8 | Enable compression on ALL continuous aggregates | `init.sql` + live DB |
| 1.9 | Add missing unique constraints (6 tables) | `init.sql` + live DB |
| 1.10 | Update Prisma schema: unique constraints + aggregate models | `schema.prisma` |
| 1.11 | Remove duplicate `unique_candle_per_minute` index | `schema.prisma` + live DB |
| 1.12 | Run `npx prisma migrate dev` | Migration file |

### Phase 2: Schema Separation (Future)

| Step | Action |
|------|--------|
| 2.1 | Create schemas: `market`, `master`, `app`, `billing`, `ops` |
| 2.2 | Move tables with `ALTER TABLE ... SET SCHEMA` |
| 2.3 | Add Prisma `multiSchema` preview + `@@schema()` annotations |
| 2.4 | Update raw SQL in Layers 1, 2, 4, 5 |
| 2.5 | Update backup scripts for per-schema dumps |

### Phase 3: Historical Backfill

| Step | Action |
|------|--------|
| 3.1 | With retention policy removed, run full backfill via Swarm Mode |
| 3.2 | Backfill M&M pattern: each symbol from earliest available date |
| 3.3 | Verify row counts match expected: `252 days × 375 candles × symbols` |
| 3.4 | Refresh all continuous aggregates: `CALL refresh_continuous_aggregate(...)` |
| 3.5 | Take fresh backup after backfill completes |

---

## Files to Modify (Summary)

| File | Changes |
|------|---------|
| `layer-3-storage/timescaledb/migrations/init.sql` | Remove retention, chunk → 1 week, explicit compress_orderby, add candles_4h, add unique constraints, add aggregate compression |
| `infrastructure/compose/docker-compose.infra.yml` | Fix work_mem, set synchronous_commit=on, reduce commit_delay |
| `infrastructure/compose/docker-compose.resources.yml` | TimescaleDB: 6 CPU / 12 GB |
| `layer-7-core-interface/api/prisma/schema.prisma` | Add aggregate models, add unique constraints, remove duplicate index |
| `Makefile` | Add `backup-daily`, `backup-archive` targets |
