# ⚡ Layer 4: Analysis Engine

**Technology:** Go (Goroutines)  
**Latency:** ~10ms  
**Responsibility:** Parallel technical analysis of all 50 stocks

---

## 📋 Overview

The Analysis Engine is the **most critical layer** for performance. It calculates 10+ technical indicators for all 50 Nifty stocks **simultaneously** using Go's lightweight goroutines.

### Key Achievement

| Approach | Time | Feasibility |
|----------|------|-------------|
| Sequential (50 × 20ms) | 1000ms | ❌ Too slow |
| **Parallel (50 goroutines)** | **~10ms** | ✅ **100x faster** |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ANALYSIS ENGINE (Go)                               │
│                                                                         │
│   TRIGGER: New 1-minute candle published to Redis                       │
│                           │                                             │
│                           ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              GOROUTINE POOL (50 workers)                        │   │
│   │                                                                 │   │
│   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        ┌──────┐          │   │
│   │  │ RELI │ │ TCS  │ │ HDFC │ │ INFY │  ...   │ COAL │          │   │
│   │  │ANCE  │ │      │ │ BANK │ │      │        │INDIA │          │   │
│   │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘        └──┬───┘          │   │
│   │     │        │        │        │               │               │   │
│   │     └────────┴────────┴────────┴───────────────┘               │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              INDICATOR DEPENDENCY WAVES                         │   │
│   │                                                                 │   │
│   │   WAVE 1 (Independent - Parallel):              ~5ms            │   │
│   │   ├── RSI(14)                                                   │   │
│   │   ├── EMA(9, 21, 55, 200)                                      │   │
│   │   ├── ATR(14)                                                   │   │
│   │   ├── VWAP                                                      │   │
│   │   ├── Bollinger Bands(20, 2)                                   │   │
│   │   └── Volume Profile                                            │   │
│   │                                                                 │   │
│   │   WAVE 2 (Dependent - After Wave 1):            ~3ms            │   │
│   │   ├── MACD(12, 26, 9) ← needs EMAs                             │   │
│   │   ├── Supertrend(10, 3) ← needs ATR                            │   │
│   │   └── Trend Score                                               │   │
│   │                                                                 │   │
│   │   WAVE 3 (Final):                               ~1ms            │   │
│   │   └── Composite Stock Score (-1 to +1)                         │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│                   TOTAL: ~9-10ms for ALL 50 stocks!                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
layer-4-analysis/
├── README.md
├── go.mod
├── go.sum
├── Dockerfile
│
├── cmd/
│   └── main.go               # Entry point
│
├── internal/
│   ├── analyzer/
│   │   ├── engine.go         # Main analysis engine
│   │   ├── worker.go         # Goroutine worker
│   │   └── scheduler.go      # Analysis scheduler
│   │
│   ├── indicators/
│   │   ├── rsi.go            # RSI calculation
│   │   ├── ema.go            # EMA calculation
│   │   ├── macd.go           # MACD calculation
│   │   ├── atr.go            # ATR calculation
│   │   ├── vwap.go           # VWAP calculation
│   │   ├── supertrend.go     # Supertrend calculation
│   │   └── bollinger.go      # Bollinger Bands
│   │
│   ├── models/
│   │   ├── candle.go         # Candle struct
│   │   ├── indicator.go      # Indicator results
│   │   └── analysis.go       # Analysis result
│   │
│   └── storage/
│       └── redis.go          # Redis client
│
└── config/
    └── config.yaml
```

## 🚀 Quick Start

```bash
# Install dependencies
go mod download

# Run the analysis engine
go run cmd/main.go

# Build binary
go build -o analysis-engine cmd/main.go
```

## 📊 Technical Indicators

| Indicator | Period | Output |
|-----------|--------|--------|
| RSI | 14 | 0-100 |
| EMA | 9, 21, 55, 200 | Price level |
| MACD | 12, 26, 9 | MACD Line, Signal, Histogram |
| ATR | 14 | Volatility value |
| VWAP | Session | Price level |
| Supertrend | 10, 3 | Trend direction + level |
| Bollinger Bands | 20, 2 | Upper, Middle, Lower |

## 🔧 Configuration

```yaml
# config/config.yaml
analysis:
  workers: 50                    # One per stock
  timeout: 100ms                 # Max analysis time
  indicators:
    rsi_period: 14
    ema_periods: [9, 21, 55, 200]
    macd_fast: 12
    macd_slow: 26
    macd_signal: 9
    atr_period: 14
    supertrend_period: 10
    supertrend_multiplier: 3.0
    bollinger_period: 20
    bollinger_std: 2.0

redis:
  url: "redis://localhost:6379"
  pool_size: 10
```

## 📈 Output Schema

```go
type StockAnalysis struct {
    Symbol      string    `json:"symbol"`
    Timestamp   time.Time `json:"timestamp"`
    
    // Price data
    LTP         float64   `json:"ltp"`
    Change      float64   `json:"change"`
    ChangePct   float64   `json:"change_pct"`
    
    // Indicators
    RSI         float64   `json:"rsi"`
    MACD        MACDResult `json:"macd"`
    EMAs        map[int]float64 `json:"emas"`
    ATR         float64   `json:"atr"`
    VWAP        float64   `json:"vwap"`
    Supertrend  SupertrendResult `json:"supertrend"`
    Bollinger   BollingerResult `json:"bollinger"`
    
    // Derived scores
    TrendScore    float64 `json:"trend_score"`    // -1 to +1
    MomentumScore float64 `json:"momentum_score"` // -1 to +1
    CompositeScore float64 `json:"composite_score"` // -1 to +1
    
    // Metadata
    LatencyMs   int64   `json:"latency_ms"`
}
```

## 🐹 Why Go?

| Feature | Benefit |
|---------|---------|
| **Goroutines** | Lightweight (2KB vs 1MB threads), can run 50 easily |
| **Channels** | Built-in synchronization, no explicit locks |
| **Fast Math** | Compiled code = fast floating-point operations |
| **Low GC** | Modern Go has sub-millisecond GC pauses |
| **Single Binary** | Easy deployment, no dependencies |

## 📈 Metrics

```
# Prometheus metrics
analysis_duration_seconds{symbol="RELIANCE"}
analysis_total{status="success"}
analysis_total{status="error"}
goroutines_active
```

## 🧪 Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run benchmarks
go test -bench=. ./internal/indicators/
```

## 🐳 Docker

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o analysis-engine cmd/main.go

FROM alpine:latest
COPY --from=builder /app/analysis-engine /analysis-engine
CMD ["/analysis-engine"]
```

---

**Previous:** [Layer 3 - Storage](../layer-3-storage/README.md)  
**Next:** [Layer 5 - Aggregation](../layer-5-aggregation/README.md)
