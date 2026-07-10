# Layer 4 — Analysis (Technical Indicators)

> **One job:** Compute technical indicators for 50 stocks in parallel.
> **Tech:** Go 1.23 · **Port:** 8081

## Architecture

```
candles_1m (TimescaleDB) → 50 goroutines → StockAnalysis → Redis publish
                              │
                              ├── RSI (Wilder's smoothing)
                              ├── MACD (12/26/9)
                              ├── EMA (9, 21, 55, 200)
                              ├── ATR (14)
                              ├── VWAP
                              ├── Supertrend (10, 3)
                              ├── Bollinger Bands (20, 2)
                              └── ADX + Ichimoku
```

## Files

| File | Purpose |
|------|---------|
| `internal/indicators/indicators.go` | All indicator implementations |
| `internal/indicators/indicators_test.go` | 10 tests including benchmarks |
| `internal/analyzer/engine.go` | 50-stock parallel analysis engine |
| `internal/db/client.go` | TimescaleDB queries (candles_1m) |
| `internal/redis/client.go` | Redis publish (analysis_updates) |
| `internal/ai/client.go` | Calls L9 AI inference |

## Key Constants (from Go shared module)

```go
import shared "github.com/utkarsh-pandey/nifty50-trading-system/shared"
// shared.TrendUp, shared.PortAnalysis, shared.TopicAnalysisUpdates
```

## Run

```bash
make layer4          # Local dev (Go run)
go test ./...        # 10 tests + benchmarks
```
