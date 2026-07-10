# Layer 5 — Aggregation (Market Breadth)

> **One job:** Aggregate per-stock indicators into market-wide breadth, sector rotation, and VIX regime.
> **Tech:** Go 1.23 · **Port:** 8080

## Architecture

```
analysis_updates (Redis) → 50 stocks → BreadthMetrics → Redis publish
                              │
                              ├── A/D Ratio
                              ├── %>EMA20, %>EMA50, %>EMA200
                              ├── Sector Momentum (17 sectors)
                              ├── Top Gainers/Losers
                              └── Market Sentiment (STRONGLY_BULLISH → STRONGLY_BEARISH)
```

## Files

| File | Purpose |
|------|---------|
| `internal/breadth/breadth.go` | `CalculateBreadth()` → A/D ratio, EMA thresholds, sentiment |
| `internal/breadth/breadth_test.go` | 7 tests: bull, bear, neutral markets |
| `internal/aggregator/aggregator.go` | Main engine: 60s loop, concurrent stock analysis |
| `internal/sectors/sectors.go` | Nifty 50 → 17 sector mapping |
| `internal/db/client.go` | TimescaleDB queries (candles_1m) |
| `internal/redis/client.go` | Redis publish (market_view) |

## Key Constants

```go
import shared "github.com/utkarsh-pandey/nifty50-trading-system/shared"
// shared.SentimentBullish, shared.SectorStrongUp, shared.PortAggregation
```

## Run

```bash
make layer5          # Local dev (Go run)
go test ./...        # 7 breadth tests
```
