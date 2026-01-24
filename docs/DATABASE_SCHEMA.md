# 🗄️ Database Schema Architecture

**Version:** 2.0  
**Last Updated:** January 2026  
**Authors:** Yogendra Singh

---

## 📊 Executive Summary

This document outlines the complete database architecture for the Nifty 50 Trading System, including data volume projections, schema design decisions, and implementation details.

**Key Decisions:**

- **Database**: TimescaleDB (PostgreSQL extension optimized for time-series)
- **Base Granularity**: **1-minute candle data** (broker minimum supported interval)
- **Derived Views**: 5m, 15m, 30m, 1h, 1d, weekly (continuous aggregates)
- **Architecture**: One database with multiple logical schemas
- **Tables**: 22 tables across 6 domains
- **Storage Projection**:
  - **5 Years**: ~2-3 GB (with compression)
  - **10 Years**: ~3-5 GB (with compression)

> **Note:** Broker API (MStock) minimum interval is `minute`. Real-time WebSocket ticks are aggregated to 1-minute candles in Layer 2 Processing.

---

## 📈 Data Volume Analysis (1-Minute Base)

### Trading Parameters

| Parameter          | Value                             |
| ------------------ | --------------------------------- |
| Trading Hours      | 9:15 AM - 3:30 PM IST             |
| Trading Duration   | 6h 15m = **375 minutes**          |
| Trading Days/Month | ~20 days                          |
| Trading Days/Year  | ~240 days                         |
| Stocks Tracked     | 50 (Nifty 50, expandable to 100+) |

### Volume Projections (50 Stocks)

| Timeframe           | Rows/Day   | Rows/Month  | Rows/Year | 5 Years   | 10 Years       |
| ------------------- | ---------- | ----------- | --------- | --------- | -------------- |
| **1-minute (BASE)** | **18,750** | **375,000** | **4.5M**  | **22.5M** | **45 Million** |
| 5-minute (view)     | 3,750      | 75,000      | 900,000   | 4.5M      | 9M             |
| 15-minute (view)    | 1,250      | 25,000      | 300,000   | 1.5M      | 3M             |
| 30-minute (view)    | 625        | 12,500      | 150,000   | 750,000   | 1.5M           |
| 1-hour (view)       | 312        | 6,240       | 74,880    | 374,400   | 748,800        |
| 1-day (view)        | 50         | 1,000       | 12,000    | 60,000    | 120,000        |
| Weekly (view)       | 50         | 200         | 2,400     | 12,000    | 24,000         |

### Storage Estimates (1-Minute Base Data)

| Duration     | Raw Size | With Compression (90%) | Notes                   |
| ------------ | -------- | ---------------------- | ----------------------- |
| **1 Year**   | ~350 MB  | **~35-50 MB**          | Production minimum      |
| **5 Years**  | ~1.7 GB  | **~200-300 MB**        | Recommended retention   |
| **10 Years** | ~3.5 GB  | **~350-500 MB**        | Full historical archive |

### Scalability Projections

| Stocks             | 5 Years (Compressed) | 10 Years (Compressed) | Notes                |
| ------------------ | -------------------- | --------------------- | -------------------- |
| 50 (Nifty 50)      | ~200-300 MB          | ~350-500 MB           | Current scope        |
| 100 (Nifty 100)    | ~400-600 MB          | ~700 MB - 1 GB        | 2x scaling           |
| 200 (Nifty 200)    | ~800 MB - 1.2 GB     | ~1.5-2 GB             | Enterprise scale     |
| 500 (FnO Universe) | ~2-3 GB              | ~4-5 GB               | Full market coverage |

### Storage Infrastructure Requirements

| Scale                 | Storage Type | Recommended | Monthly Cost (AWS) |
| --------------------- | ------------ | ----------- | ------------------ |
| 50 stocks / 5 years   | SSD (GP3)    | 20 GB       | ~$2                |
| 50 stocks / 10 years  | SSD (GP3)    | 20 GB       | ~$2                |
| 200 stocks / 10 years | SSD (GP3)    | 50 GB       | ~$5                |
| 500 stocks / 10 years | SSD (GP3)    | 100 GB      | ~$10               |

### Data Flow: Base → Derived Views

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     1-MINUTE CANDLES (BASE HYPERTABLE)                       │
│                     45 Million rows / 10 years (~350-500 MB)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (Continuous Aggregates - Auto-computed)
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  candles_5m   │           │  candles_15m  │           │  candles_30m  │
│    9M rows    │           │    3M rows    │           │   1.5M rows   │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  candles_1h   │           │  candles_1d   │           │ candles_weekly│
│   749K rows   │           │   120K rows   │           │   24K rows    │
└───────────────┘           └───────────────┘           └───────────────┘
```

---

## 🏗️ Architecture Decision

### Single Database with Multiple Schemas

```
PostgreSQL/TimescaleDB (One Instance)
│
├── Schema: market      ← Time-series hypertables
│   └── candles_1m, candles_5m/15m/1h/1d, options_chain
│
├── Schema: reference   ← Master data (regular tables)
│   └── instruments, sectors, trading_calendar
│
├── Schema: analysis    ← Computed data (hypertables)
│   └── signals, market_breadth, sector_strength, technical_indicators
│
├── Schema: app         ← User data (regular tables)
│   └── users, user_alerts, user_watchlists, user_subscribers
│
├── Schema: billing     ← Payment data (regular tables, isolate later)
│   └── plans, subscriptions, payments, invoices
│
└── Schema: system      ← System metadata (mix)
    └── data_availability, backfill_jobs, system_config, audit_log
```

### Why This Approach?

| Factor           | One DB + Schemas          | Multiple DBs          |
| ---------------- | ------------------------- | --------------------- |
| **Simplicity**   | ✅ Easy to manage         | ❌ Complex            |
| **Cost**         | ✅ Single instance        | ❌ Multiple instances |
| **JOINs**        | ✅ Cross-domain queries   | ❌ Not possible       |
| **Scaling**      | ⚠️ Scale together         | ✅ Independent        |
| **Future Split** | ✅ Easy to separate later | N/A                   |

---

## 🔄 Data Watermark System (Duplicate Prevention)

### Problem

When running backfills, we need to:

1. Know what data already exists
2. Only fetch missing date ranges
3. Prevent duplicate insertions

### Solution: 3-Layer Protection

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: data_availability Table                                │
│  ─────────────────────────────────────────────────────────────  │
│  Before fetching, check what data exists:                        │
│  SELECT first_date, last_date FROM data_availability             │
│  WHERE symbol = 'RELIANCE' AND timeframe = '1m';                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Unique Constraint                                      │
│  ─────────────────────────────────────────────────────────────  │
│  UNIQUE (time, symbol) on candles_1m                            │
│  Database will reject duplicates automatically                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Upsert on Insert                                       │
│  ─────────────────────────────────────────────────────────────  │
│  INSERT INTO candles_1m (...) ON CONFLICT DO NOTHING;           │
│  Silently skip any duplicates that slip through                  │
└─────────────────────────────────────────────────────────────────┘
```

### data_availability Table Structure

```sql
CREATE TABLE data_availability (
    symbol      TEXT NOT NULL,
    timeframe   TEXT NOT NULL,        -- '1m', '5m', '1h', '1d'
    first_date  DATE NOT NULL,        -- Earliest data we have
    last_date   DATE NOT NULL,        -- Latest data we have
    total_rows  BIGINT DEFAULT 0,     -- Total records
    gaps        JSONB DEFAULT '[]',   -- Missing date ranges
    PRIMARY KEY (symbol, timeframe)
);
```

---

## 📋 Complete Schema (22 Tables)

### 1. Market Data (6 entities)

| Table           | Type                 | Purpose             | Retention                       |
| --------------- | -------------------- | ------------------- | ------------------------------- |
| `candles_1m`    | Hypertable           | Base 1-minute OHLCV | 1 year hot, 10 years compressed |
| `candles_5m`    | Continuous Aggregate | Auto-rolled from 1m | Same as 1m                      |
| `candles_15m`   | Continuous Aggregate | Auto-rolled from 1m | Same as 1m                      |
| `candles_1h`    | Continuous Aggregate | Auto-rolled from 1m | Same as 1m                      |
| `candles_1d`    | Continuous Aggregate | Auto-rolled from 1m | Forever                         |
| `options_chain` | Hypertable           | Options Greeks/OI   | 30 days                         |

### 2. Reference Data (3 entities)

| Table              | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `instruments`      | Stock master (symbol, sector, token, is_nifty50) |
| `sectors`          | Sector definitions (IT, Banking, Auto, etc.)     |
| `trading_calendar` | Holidays, market hours                           |

### 3. Analysis Data (4 entities)

| Table                  | Type       | Purpose                    |
| ---------------------- | ---------- | -------------------------- |
| `signals`              | Hypertable | Generated buy/sell signals |
| `market_breadth`       | Hypertable | A/D ratio, new highs/lows  |
| `sector_strength`      | Hypertable | Sector rotation tracking   |
| `technical_indicators` | Hypertable | Cached RSI, EMA, MACD      |

### 4. User Data (4 entities)

| Table              | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `users`            | User accounts (telegram_id, email, is_premium) |
| `user_alerts`      | Price/indicator alerts                         |
| `user_watchlists`  | Custom stock lists                             |
| `user_subscribers` | Email newsletter subscriptions                 |

### 5. Billing Data (4 entities)

| Table           | Purpose                                               |
| --------------- | ----------------------------------------------------- |
| `plans`         | Subscription tiers (Free, Basic, Premium, Enterprise) |
| `subscriptions` | User subscription records                             |
| `payments`      | Payment transactions (Razorpay/Stripe)                |
| `invoices`      | Billing documents                                     |

### 6. System Data (4 entities)

| Table               | Purpose                              |
| ------------------- | ------------------------------------ |
| `data_availability` | Tracks what data exists (watermarks) |
| `backfill_jobs`     | Historical data job tracking         |
| `system_config`     | Key-value configuration store        |
| `audit_log`         | System event logging                 |

---

## 💾 Backup Strategy

### Backup Frequency

| Data Type    | Frequency | Retention | Method               |
| ------------ | --------- | --------- | -------------------- |
| Market Data  | Daily     | 30 days   | pg_dump → S3         |
| User Data    | Hourly    | 7 days    | pg_dump → S3         |
| Billing Data | Real-time | 1 year    | WAL archiving → S3   |
| Configs      | On change | Forever   | Git (config as code) |

### Recovery Point Objective (RPO)

| Data Type    | Max Data Loss                       |
| ------------ | ----------------------------------- |
| Market Data  | 24 hours (can re-fetch from broker) |
| User Data    | 1 hour                              |
| Billing Data | 0 (real-time replication)           |

---

## 🔧 TimescaleDB Features Used

### 1. Hypertables

Auto-partitions data by time for efficient queries and management.

```sql
SELECT create_hypertable('candles_1m', 'time',
    chunk_time_interval => INTERVAL '1 day');
```

### 2. Continuous Aggregates

Automatic rollups from 1m → 5m/15m/1h/1d.

```sql
CREATE MATERIALIZED VIEW candles_1h
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS time,
       symbol, first(open, time), max(high),
       min(low), last(close, time), sum(volume)
FROM candles_1m
GROUP BY 1, symbol;
```

### 3. Compression

90%+ space savings after data ages.

```sql
ALTER TABLE candles_1m SET (timescaledb.compress);
SELECT add_compression_policy('candles_1m', INTERVAL '7 days');
```

### 4. Retention Policies

Automatic cleanup of old data.

```sql
SELECT add_retention_policy('audit_log', INTERVAL '90 days');
```

---

## 📁 Migration Files

| File                      | Description                                 |
| ------------------------- | ------------------------------------------- |
| `001_init_schema.sql`     | Original schema (candles, signals, options) |
| `002_extended_schema.sql` | Extended schema (users, billing, system)    |

### Apply Migration

```bash
docker exec -i timescaledb psql -U trading -d nifty50 \
  < layer-3-storage/timescaledb/migrations/002_extended_schema.sql
```

---

## 🚀 Query Examples

### Get latest prices for all Nifty 50

```sql
SELECT DISTINCT ON (symbol) symbol, time, close as price
FROM candles_1m
ORDER BY symbol, time DESC;
```

### Check data availability

```sql
SELECT symbol, first_date, last_date,
       (last_date - first_date) as days_available
FROM data_availability
WHERE timeframe = '1m'
ORDER BY symbol;
```

### Get daily OHLC

```sql
SELECT * FROM candles_1d
WHERE symbol = 'RELIANCE'
  AND time >= NOW() - INTERVAL '30 days'
ORDER BY time DESC;
```

---

## 📊 Monitoring Queries

### Database size

```sql
SELECT pg_size_pretty(pg_database_size('nifty50'));
```

### Table sizes

```sql
SELECT hypertable_name,
       pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)))
FROM timescaledb_information.hypertables;
```

### Compression stats

```sql
SELECT hypertable_name,
       before_compression_total_bytes,
       after_compression_total_bytes,
       compression_ratio
FROM timescaledb_information.hypertable_compression_stats;
```

---

> **Next Steps:**
>
> 1. Seed `instruments` table with Nifty 50 stocks
> 2. Seed `trading_calendar` with 2026 holidays
> 3. Implement data watermark logic in ingestion layer

---

## ❓ FAQ - Architecture Discussion

_Questions raised by Yogendra Singh and Utkarsh during the design phase, with justifications._

---

### Q1: Should each Nifty 50 stock have its own table (50 tables) or one big table?

**Asked by:** Yogendra Singh

**Answer:** **One table for all stocks** ✅

**Justification:**

| Factor               | One Table                   | 50 Separate Tables                 |
| -------------------- | --------------------------- | ---------------------------------- |
| Query single stock   | ✅ Fast with `symbol` index | ✅ Fast                            |
| Query all 50 stocks  | ✅ Single query             | ❌ Need 50 queries or UNION        |
| Compare stocks       | ✅ Easy JOIN                | ❌ Complex cross-table JOINs       |
| Add new stock        | ✅ Just insert data         | ❌ Create new table + code changes |
| Schema changes       | ✅ Change 1 table           | ❌ Change 50 tables                |
| TimescaleDB features | ✅ Full support             | ⚠️ Need 50 hypertables             |

**Evidence:** TimescaleDB's hypertable automatically partitions data by time. With a composite index on `(symbol, time DESC)`, queries for a single stock are just as fast as having separate tables, but with much simpler management.

---

### Q2: Should we use one database or multiple databases?

**Asked by:** Yogendra Singh

**Answer:** **One database with multiple schemas** ✅ (for now)

**Justification:**

| Approach                | Pros                             | Cons                         |
| ----------------------- | -------------------------------- | ---------------------------- |
| **One DB**              | Simple, cheap, easy JOINs        | Scale together               |
| **Multiple DBs**        | Isolated scaling, security       | Complex, expensive, no JOINs |
| **One DB + Schemas** ✅ | Best of both: organized + simple | Can split later if needed    |

**Evidence:** At current scale (50 stocks, ~300 MB/year), one database is sufficient. Schemas provide logical separation. If billing needs PCI-DSS compliance later, we can easily extract the `billing` schema to a separate database without redesigning the whole system.

---

### Q3: How do we track what data has been ingested and prevent duplicates?

**Asked by:** Yogendra Singh

**Answer:** **3-layer watermark system** ✅

**Justification:**

1. **`data_availability` table** - Check before fetching → avoid redundant API calls
2. **Unique constraint** - Database rejects duplicates automatically
3. **`ON CONFLICT DO NOTHING`** - Silent skip for any edge cases

**Evidence:** Without this system:

- Backfill from Jan-Dec when Jun-Nov already exists = 12 months fetched
- With this system = only 5 months fetched (Jan-May)
- Saves **58% API calls** and prevents data corruption

---

### Q4: Should we use 1-second tick data as base or 1-minute candles?

**Asked by:** Yogendra Singh, Utkarsh

**Answer:** **1-minute as base** ✅ (Broker API limitation)

**Justification:**

| Approach             | Pros                              | Cons                          |
| -------------------- | --------------------------------- | ----------------------------- |
| **1-minute base** ✅ | Broker supported, smaller storage | Lose tick-level precision     |
| 1-second base        | Full granularity                  | ❌ Not available from broker! |

**Decision:** Store 1-minute candles as base, create continuous aggregates for 5m/15m/30m/1h/1d/weekly.

**Evidence:**

- **Broker Limitation**: MStock API minimum interval is `minute` (no 1-second historical data)
- **Storage efficient**: ~350-500 MB for 10 years (50 stocks)
- **Cost effective**: ~$2/month AWS storage
- **Sufficient for trading**: RSI, MACD, EMA all work on 1-minute or higher

**Derived Views (Auto-computed):**

```
candles_1m (BASE) → candles_5m → candles_15m → candles_30m → candles_1h → candles_1d → candles_weekly
```

---

### Q5: What about storing user data, payments, and subscriptions?

**Asked by:** Yogendra Singh

**Answer:** **Include in same database, separate schema** ✅

**Justification:**

| Domain      | Volume                | Criticality           | Backup    |
| ----------- | --------------------- | --------------------- | --------- |
| Market data | High (45M rows/10yrs) | Medium (can re-fetch) | Daily     |
| User data   | Low (~10K users)      | High                  | Hourly    |
| Payments    | Low (~1K/month)       | **Critical**          | Real-time |

**Evidence:** With proper schemas:

- `app.users`, `app.user_alerts` → User features
- `billing.payments`, `billing.invoices` → Can migrate to separate DB for PCI-DSS later

We can JOIN user preferences with market data (e.g., "notify user X when RELIANCE crosses ₹2500") which isn't possible with separate databases.

---

### Q6: What database technology should we use?

**Asked by:** Yogendra Singh, Utkarsh

**Answer:** **TimescaleDB (PostgreSQL extension)** ✅

**Justification:**

| Requirement         | TimescaleDB              | Plain PostgreSQL | MongoDB      |
| ------------------- | ------------------------ | ---------------- | ------------ |
| Time-series queries | ✅ Optimized             | ⚠️ Manual        | ❌ Not ideal |
| SQL support         | ✅ Full                  | ✅ Full          | ❌ No        |
| Compression         | ✅ 90% built-in          | ❌ Manual        | ⚠️ Varies    |
| Auto-aggregates     | ✅ Continuous aggregates | ❌ Must compute  | ❌ Manual    |
| Relational data     | ✅ Yes (users, payments) | ✅ Yes           | ⚠️ Limited   |

**Evidence:**

- Candle data is inherently time-series (timestamp + OHLCV)
- TimescaleDB auto-partitions by time (hypertables)
- Continuous aggregates auto-compute 5m/15m/1h/1d views
- Still PostgreSQL, so billing tables work normally

---

### Q7: How much storage and what are AWS cloud costs?

**Asked by:** Yogendra Singh

**Answer:** **~350-500 MB for 10 years, ~$30-50/month on AWS** ✅

**Storage Calculation (1-Minute Base):**

```
1-minute candles:
  50 stocks × 375 candles/day × 240 days/year × 10 years
  = 45,000,000 rows (45 Million)

Row size: ~80 bytes (time, symbol, open, high, low, close, volume)
Raw size: 45M × 80 = ~3.5 GB

With TimescaleDB compression (90%): ~350-500 MB
```

**AWS Cloud Hosting Costs (Monthly):**

| Component           | Service             | Spec                      | Cost/Month     |
| ------------------- | ------------------- | ------------------------- | -------------- |
| **Database**        | RDS PostgreSQL      | db.t3.micro (1 vCPU, 1GB) | ~$15           |
| **Storage**         | GP3 SSD             | 20 GB                     | ~$2            |
| **Backup**          | Automated snapshots | 30 days retention         | ~$2            |
| **Redis Cache**     | ElastiCache         | cache.t3.micro            | ~$12           |
| **Total (Minimal)** |                     |                           | **~$31/month** |

**Cost by Scale:**

| Scale               | DB Instance  | Storage | Redis           | Total/Month |
| ------------------- | ------------ | ------- | --------------- | ----------- |
| **Dev/Test**        | db.t3.micro  | 20 GB   | cache.t3.micro  | **~$30**    |
| **50 stocks/5yr**   | db.t3.micro  | 20 GB   | cache.t3.micro  | **~$30**    |
| **50 stocks/10yr**  | db.t3.small  | 50 GB   | cache.t3.small  | **~$45**    |
| **200 stocks/10yr** | db.t3.medium | 100 GB  | cache.t3.small  | **~$70**    |
| **Enterprise**      | db.t3.large  | 500 GB  | cache.t3.medium | **~$150**   |

**Alternative: Local Docker (Current Setup):**

| Scenario                  | Storage   | Monthly Cost           |
| ------------------------- | --------- | ---------------------- |
| Mac Mini M2 (home server) | 1 TB SSD  | ~$0 (electricity only) |
| EC2 Spot (t3.medium)      | 50 GB EBS | ~$15-20                |
| EC2 On-Demand (t3.medium) | 50 GB EBS | ~$35-40                |

**Evidence:** 1-minute data is ~60x smaller than 1-second data, significantly reducing storage and costs.

---

### Q8: How do we handle backup and recovery?

**Asked by:** Utkarsh

**Answer:** **Tiered backup strategy** ✅

| Data     | Backup        | Reason                             |
| -------- | ------------- | ---------------------------------- |
| Market   | Daily to S3   | Can re-fetch from broker if needed |
| Users    | Hourly to S3  | Critical, but low volume           |
| Payments | Real-time WAL | Zero data loss requirement         |
| Configs  | Git           | Version controlled                 |

**Evidence:** Market data is recoverable from broker APIs, so daily backups are sufficient. Payment data requires PCI-DSS compliance with point-in-time recovery, hence WAL archiving.

---

### Q9: Should we store computed indicators (RSI, EMA) in the database?

**Asked by:** Yogendra Singh

**Answer:** **Yes, cache in `technical_indicators` table** ✅

**Justification:**

| Approach           | Pros                    | Cons                |
| ------------------ | ----------------------- | ------------------- |
| Compute on-demand  | Always fresh            | Slow for 50 stocks  |
| **Cache in DB** ✅ | Fast reads, precomputed | Slight staleness ok |

**Evidence:** Layer 4 (Analysis) computes RSI/EMA every minute. Storing in `technical_indicators` table means:

- Dashboard loads instantly (no recalculation)
- Historical analysis possible
- Can query "all stocks where RSI < 30"

---

_Document prepared during architecture planning session, January 2026_
