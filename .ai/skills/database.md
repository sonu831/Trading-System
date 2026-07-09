# Skill: Database Operations (TimescaleDB + Redis)

> **For schema changes, queries, and CQRS read/write paths.** Covers both
> TimescaleDB (write/history) and Redis (read/realtime).

## CQRS Rule (non-negotiable)

```
WRITES: Layer 3 -> TimescaleDB (hypertables, partitioned by time)
READS:  Layer 3 -> Redis (cached, TTL-based expiry)
```

**Layer 7 (API) never touches TimescaleDB directly.** It reads from Redis.
If Redis misses, it calls Layer 3, which queries TimescaleDB and populates Redis.

## TimescaleDB Patterns

### Creating a hypertable
```sql
CREATE TABLE ticks (
    symbol      TEXT NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL,
    ltp         DOUBLE PRECISION,
    volume      BIGINT,
    bid         DOUBLE PRECISION,
    ask         DOUBLE PRECISION
);

SELECT create_hypertable('ticks', 'timestamp',
    chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX idx_ticks_symbol_time ON ticks (symbol, timestamp DESC);
```

### Always use ON CONFLICT DO NOTHING
```sql
INSERT INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (symbol, timeframe, timestamp) DO NOTHING;
```

### Continuous aggregates (materialized views)
```sql
CREATE MATERIALIZED VIEW candles_1min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', timestamp) AS bucket,
    symbol,
    FIRST(open, timestamp) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, timestamp) AS close,
    SUM(volume) AS volume
FROM ticks
GROUP BY bucket, symbol;
```

### Compression
```sql
ALTER TABLE ticks SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol'
);
SELECT add_compression_policy('ticks', INTERVAL '7 days');
```

## Redis Patterns

### Key naming
```
{layer}:{entity}:{identifier}:{field}
```
Examples:
```
tick:RELIANCE:latest          -> Hash {ltp, volume, bid, ask, timestamp}
candle:INFY:5m:latest         -> Hash {o, h, l, c, v, timestamp}
candle:TCS:1h:series          -> Sorted Set (timestamp -> JSON)
indicator:NIFTY:RSI           -> String "58.4"
sentiment:market              -> Hash {breadth, regime, fear_greed}
signal:BANKNIFTY:latest       -> Hash {direction, confidence, entry}
```

### TTL strategy
```
Real-time ticks:     60s TTL
Candle latest:       1h TTL
Candle series:       24h TTL
Indicator values:    5m TTL
Sentiment scores:    1m TTL
Signals:             1h TTL
```

### Redis Streams for real-time push
```bash
# Layer 3 publishes to stream
XADD tick:RELIANCE * ltp 2540.50 volume 100000

# Layer 7 (API) reads stream for Socket.io
XREAD BLOCK 0 STREAMS tick:RELIANCE 0
```

## Rules

1. **Always use ON CONFLICT DO NOTHING** for idempotent inserts
2. **Always add indexes for query patterns** before deploying
3. **Redis keys must have TTL** -- no infinite-lived keys
4. **Never run DROP/TRUNCATE in production** without explicit approval
5. **Test migrations forward AND backward** (up + down)
6. **Monitor chunk sizes** -- re-chunk if > 1GB per chunk
