# Layer 3: Storage Instructions

## Overview

This layer manages the persistence of market data. It uses a polyglot persistence architecture: **Redis** for hot/real-time data and **TimescaleDB** (PostgreSQL extension) for historical time-series data.

## Database Guidelines

### Redis (Hot Storage)

- **Key Naming Scheme**: Use colon-separated keys.
  - `tick:latest:<SYMBOL>`
  - `candle:current:<TIMEFRAME>:<SYMBOL>`
  - `signal:active:<SYMBOL>`
- **TTL**: Always set a Time-To-Live (TTL) for ephemeral data to prevent memory leaks.
- **Data Types**:
  - Use `Hashes` for objects (candles).
  - Use `Pub/Sub` for real-time notifications.

### TimescaleDB (Warm Storage)

- **Hypertables**: All candle tables must be persistent hypertables partitioned by `time`.
- **Compression**: Enable native TimescaleDB compression for older chunks (e.g., > 24 hours).
- **Continuous Aggregates**: Use materialized views for creating larger timeframes (e.g., creating 1h candles from 1m candles).

```sql
-- Example Hypertable Creation
CREATE TABLE candles_1m (
  time TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  open DOUBLE PRECISION,
  high DOUBLE PRECISION,
  low DOUBLE PRECISION,
  close DOUBLE PRECISION,
  volume BIGINT
);
SELECT create_hypertable('candles_1m', 'time');
```

## Management & Operations

### Backup & Restore

- **Redis**: Rely on AOF (Append Only File) for durability. Periodic RDB snapshots are recommended for faster restarts.
- **Postgres**: Use `pg_dump` or `wal-g` for continuous archiving.

### Schema Management

- Use migration tools (like `flyway` or language-specific tools like `knex` or `golang-migrate`) to version control schema changes.
- Never manually `ALTER TABLE` in production without a tracked migration file.

## Project Structure (Infrastructure as Code)

```text
layer-3-storage/
├── migrations/          # SQL migration files
│   ├── V1__freq_trade_schema.sql
│   └── V2__add_hypertables.sql
├── redis/               # Redis configuration files
│   └── redis.conf
├── seed/                # Seed data for local dev
└── scripts/             # Backup/Restore scripts
```

## Security Considerations

- **Passwords**: Rotate database passwords regularly.
- **Network**: Redis should NOT be exposed to the public internet. Use internal persistent volumes and accessible only within the VPC/Cluster.
- **Encryption**: Enable TLS for connections if data traverses public networks.

## Testing

- **Integration Tests**: Verify that data written to the "Hot" layer eventually persists to the "Warm" layer if a sync process exists.
- **Query Performance**: Analyze slow queries using `EXPLAIN ANALYZE` on TimescaleDB.
