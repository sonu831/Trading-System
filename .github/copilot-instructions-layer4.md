# Layer 4: Analysis Engine - Go Instructions

**Role:** Senior Go Performance Engineer building a high-throughput real-time analysis engine.
**Mission:** Process 50 stocks × 300 candles × 10+ indicators every 60 seconds with <100ms batch latency.
**Stack:** Go 1.23 | pgx (TimescaleDB) | go-redis | techan | Gorilla mux | Prometheus

---

## 1. Computational Scale

This is the heaviest layer in the system. Understand the numbers before writing any code.

```
Per cycle (every 60s):
  50 stocks × 300 candles each         = 15,000 rows fetched from TimescaleDB
  50 stocks × 10 indicators each       = 500 indicator calculations
  50 stocks × 5 Wave-1 goroutines      = 250 concurrent goroutines at peak
  50 concurrent DB round-trips          = pgxpool must handle burst of 50
  50 JSON marshals + Redis publishes    = 50 pub/sub messages out

Per indicator (RSI, EMA, MACD, etc.):
  300 float64 values iterated           = ~2.4 KB per slice
  Multiple passes (e.g., MACD = 3 EMAs)= up to 900 iterations

Memory footprint per cycle:
  50 × 300 candles × ~120 bytes each   = ~1.8 MB candle data
  50 × 10 float64 slices × 300 items   = ~1.2 MB indicator scratch space
  50 × StockAnalysis result structs     = ~50 KB results
  Total working set:                    ≈ 3-4 MB per analysis cycle
```

**Design principle:** This layer is CPU-bound during indicator math and I/O-bound during DB fetch. Separate these phases — fetch all data first, then compute in parallel.

---

## 2. Architecture

```
cmd/main.go                          Entry point, signal handling, graceful shutdown
internal/
  analyzer/engine.go                 Core engine: Fan-Out/Fan-In, 4-wave stock analysis
  indicators/indicators.go           Pure math: RSI, EMA, MACD, ATR, VWAP, Supertrend, Bollinger
  indicators/scorecard.go            Techan-wrapped scorecard with recommendation
  indicators/features.go             Feature vector generation for Layer 9 AI
  api/server.go                      HTTP API (Gorilla mux), 7 endpoints on :8081
  db/client.go                       TimescaleDB (pgxpool), multi-timeframe queries
  redis/client.go                    Redis pub/sub for analysis result distribution
  ai/client.go                       HTTP client for Layer 9 AI inference (soft-fail)
```

**Data Flow:**
```
                    ┌─── DB Fetch Phase (I/O bound) ───┐
TimescaleDB ──────→ │  50 concurrent pgx queries        │
(candles_1m,        │  300 rows per symbol              │
 candles_5m..1w)    │  pgxpool manages connection reuse │
                    └──────────────┬────────────────────┘
                                   │ []Candle per stock
                    ┌─── Compute Phase (CPU bound) ────┐
                    │  WAVE 1: 5 indicators in parallel │
                    │  WAVE 2: dependent indicators     │
                    │  WAVE 3: composite scoring        │
                    └──────────────┬────────────────────┘
                                   │ StockAnalysis
                    ┌─── Publish Phase (I/O bound) ────┐
                    │  WAVE 4: AI inference (soft-fail) │
                    │  Redis pub/sub → Layer 6          │
                    │  Result caching for API queries   │
                    └──────────────────────────────────┘
```

---

## 3. Concurrency Model

### 3a. Fan-Out/Fan-In with Semaphore

50 stocks analyzed in parallel. Use a semaphore to cap goroutines if the stock universe grows.

```go
func (e *Engine) runAnalysis(ctx context.Context) {
    sem := make(chan struct{}, runtime.NumCPU()*4) // bound concurrency
    var wg sync.WaitGroup

    for _, sym := range e.symbols {
        wg.Add(1)
        go func(s string) {
            defer wg.Done()
            sem <- struct{}{}        // acquire slot
            defer func() { <-sem }() // release slot

            if ctx.Err() != nil {
                return // respect cancellation
            }
            e.analyzeStock(ctx, s)
        }(sym)
    }
    wg.Wait()
}
```

**Rules:**
- Semaphore capacity = `runtime.NumCPU() * 4` (CPU cores × hyperthreading × 2 for I/O overlap).
- Always check `ctx.Err()` before expensive work — don't start analysis if shutdown is in progress.
- Buffered result channel (200 slots) prevents goroutine leaks on slow consumers.
- Non-blocking sends: `select { case ch <- val: default: drop }` — never block the analysis pipeline.

### 3b. Wave-Based Computation (Per-Stock)

Each stock runs 4 waves. The wave design maximizes parallelism while respecting data dependencies.

```
WAVE 1 (parallel, 5 goroutines):
  ├── RSI(14)                    — needs: closes[300]
  ├── EMA(9,21,55,200)           — needs: closes[300]
  ├── ATR(14)                    — needs: highs, lows, closes
  ├── VWAP                       — needs: highs, lows, closes, volumes
  └── BollingerBands(20, 2.0)    — needs: closes[300]

WAVE 2 (sequential, reuses Wave 1):
  ├── MACD(12,26,9)              — needs: closes (independent, but kept sequential for simplicity)
  └── Supertrend(10, 3.0)        — needs: highs, lows, closes, ATR from Wave 1

WAVE 3 (pure math, single goroutine):
  ├── TrendScore     = f(EMAs, Supertrend, VWAP, close)   → [-1, +1]
  ├── MomentumScore  = f(RSI, MACD histogram)              → [-1, +1]
  └── CompositeScore = TrendScore×0.6 + MomentumScore×0.4

WAVE 4 (external I/O, soft-fail):
  └── AI Prediction via Layer 9  — 200ms timeout, returns -1 on failure
```

**Deadline budget for <100ms target:**
```
Wave 1 (parallel I/O + compute):  ~30ms  (DB fetch dominates)
Wave 2 (sequential compute):      ~5ms   (pure math on cached data)
Wave 3 (scoring):                  ~1ms   (arithmetic only)
Wave 4 (AI network call):         ~50ms  (200ms timeout, but usually ~50ms)
Overhead (scheduling, channels):   ~14ms
                                  --------
Total budget:                      100ms
```

### 3c. Backpressure Handling

If analysis takes longer than the 60s ticker interval, **skip the cycle** — never stack up.

```go
func (e *Engine) analysisLoop(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()

    e.runAnalysis(ctx) // run immediately on start

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            if e.isAnalyzing.Load() {
                log.Warn().Msg("previous analysis still running, skipping cycle")
                continue
            }
            e.runAnalysis(ctx)
        }
    }
}
```

Use `atomic.Bool` for the `isAnalyzing` flag — mutex is overkill for a single boolean.

### 3d. Periodic Tasks

```
analysisLoop:       60s ticker  — triggers runAnalysis()
metricsPublisher:   5s ticker   — publishes goroutine count, last cycle latency to Redis
```

- Always `ticker.Stop()` in defer.
- Always check `ctx.Done()` in select — clean shutdown is non-negotiable.

---

## 4. Memory & Allocation Management

### 4a. Pre-allocate everything with known sizes

```go
// WRONG — dynamic growth, GC pressure
var closes []float64
for _, c := range candles {
    closes = append(closes, c.Close)
}

// CORRECT — zero allocations after initial make
closes := make([]float64, len(candles))
for i, c := range candles {
    closes[i] = c.Close
}
```

### 4b. sync.Pool for reusable buffers

When 50 goroutines each need a `[]float64` of 300 elements, reuse them:

```go
var float64Pool = sync.Pool{
    New: func() interface{} {
        s := make([]float64, 0, 512) // slightly over 300 to avoid realloc
        return &s
    },
}

func getSlice() *[]float64 {
    s := float64Pool.Get().(*[]float64)
    *s = (*s)[:0] // reset length, keep capacity
    return s
}

func putSlice(s *[]float64) {
    float64Pool.Put(s)
}
```

Use pools when profiling (`go tool pprof`) shows high allocation rates in indicator functions.

### 4c. Avoid copying large structs

```go
// WRONG — copies Engine (contains maps, slices, mutex)
func (e Engine) analyzeStock(symbol string) StockAnalysis

// CORRECT — pointer receiver, no copy
func (e *Engine) analyzeStock(symbol string) StockAnalysis

// WRONG — range copies each candle struct
for _, candle := range candles {
    process(candle)
}

// CORRECT — range by index, no copy
for i := range candles {
    process(&candles[i])
}
```

### 4d. JSON marshal buffer reuse

For 50 Redis publishes per cycle, reuse the encoder:

```go
var bufPool = sync.Pool{
    New: func() interface{} { return new(bytes.Buffer) },
}

func publishResult(ctx context.Context, rdb *redis.Client, result *StockAnalysis) error {
    buf := bufPool.Get().(*bytes.Buffer)
    defer bufPool.Put(buf)
    buf.Reset()

    if err := json.NewEncoder(buf).Encode(result); err != nil {
        return fmt.Errorf("marshal result for %s: %w", result.Symbol, err)
    }
    return rdb.Publish(ctx, "analysis:updates", buf.Bytes()).Err()
}
```

---

## 5. Database Access (pgx)

### 5a. Connection pool sizing

Pool budget across services (total `max_connections=200`):
- Layer 4: 40 connections
- Layer 5: 20 connections  
- Layer 7 (Prisma): 30 connections
- Reserved: headroom for monitoring/admin

```go
config, _ := pgxpool.ParseConfig(connURL)
config.MaxConns = 40          // Pool budget: L4=40, L5=20, L7=30
config.MinConns = 10          // keep warm connections for low-latency first query
config.MaxConnLifetime = 30 * time.Minute
config.MaxConnIdleTime = 5 * time.Minute
config.HealthCheckPeriod = 30 * time.Second

pool, err := pgxpool.NewWithConfig(ctx, config)
```

### 5b. Hybrid data access pattern

Layer 4 uses a **hybrid data access** approach:

| Data Type | Source | Reason |
|-----------|--------|--------|
| Stock symbols, sectors | Layer 7 API | Static, cached, centralized source of truth |
| Candle OHLCV data | Direct TimescaleDB | High-frequency, performance-critical |

**Symbol loading priority:**
1. Layer 7 API `/api/v1/stocks/symbols` (preferred)
2. Shared JSON file `/app/shared/stocks/nifty50_shared.json` (fallback)

```go
// loadSymbolsFromAPI fetches from Layer 7 API first
if symbols := loadSymbolsFromAPI(); len(symbols) > 0 {
    return symbols
}
// Fall back to JSON file
if symbols := loadSymbolsFromJSON(); len(symbols) > 0 {
    return symbols
}
```

### 5c. Query patterns

- **Parameterized queries only** — never concatenate user input into SQL.
- **Validate dynamic fields** against allowlists:
  ```go
  var validAggs = map[string]bool{"avg": true, "sum": true, "min": true, "max": true, "count": true, "stddev": true}
  var validFields = map[string]bool{"open": true, "high": true, "low": true, "close": true, "volume": true}
  ```
- **IntervalTableMap** routes timeframes to continuous aggregates:
  ```go
  var IntervalTableMap = map[string]string{
      "1m": "candles_1m",  "5m": "candles_5m",  "10m": "candles_10m",
      "15m": "candles_15m", "30m": "candles_30m", "1h": "candles_1h",
      "4h": "candles_4h",  "1d": "candles_1d",   "1w": "candles_weekly",
  }
  ```
- **Fetch DESC, reverse to chronological** — DB index is `(symbol, time DESC)`.

### 5c. Row scanning optimization

Scan directly into pre-allocated structs, avoid intermediate maps:

```go
candles := make([]Candle, 0, limit)
rows, err := pool.Query(ctx, query, symbol, limit)
if err != nil {
    return nil, fmt.Errorf("query candles for %s: %w", symbol, err)
}
defer rows.Close()

for rows.Next() {
    var c Candle
    if err := rows.Scan(&c.Time, &c.Symbol, &c.Open, &c.High, &c.Low, &c.Close, &c.Volume); err != nil {
        return nil, fmt.Errorf("scan candle row: %w", err)
    }
    candles = append(candles, c)
}
```

### 5d. Batch fetching (future optimization)

Instead of 50 individual queries, batch all symbols into one query:

```go
// Single query for all 50 symbols using ANY($1)
SELECT * FROM candles_1m
WHERE symbol = ANY($1)
AND time >= NOW() - INTERVAL '2 days'
ORDER BY symbol, time DESC;

// Then partition results by symbol in Go (O(n) with map)
```

This reduces 50 round-trips to 1, cutting DB fetch time from ~30ms to ~10ms.

---

## 6. Technical Indicators

### 6a. Pure functions — zero side effects

All indicator functions are **pure**: no I/O, no logging, no globals, no allocation beyond return value.

```go
func RSI(closes []float64, period int) float64         // Wilder's smoothing
func EMA(data []float64, period int) float64            // Exponential moving average
func SMA(data []float64, period int) float64            // Simple moving average
func MACD(closes []float64, fast, slow, signal int) MACDResult
func ATR(highs, lows, closes []float64, period int) float64
func VWAP(highs, lows, closes []float64, volumes []int64) float64
func Supertrend(highs, lows, closes []float64, period int, multiplier float64) SupertrendResult
func BollingerBands(closes []float64, period int, stdDev float64) BollingerResult
func Stochastic(highs, lows, closes []float64, period, signalPeriod int) (k, d float64)
```

**Rules:**
- Return sensible defaults for insufficient data (RSI → 50.0, EMA → 0.0).
- Never panic — return zero values.
- Accept slices by reference (slices are already reference types in Go).
- `techan` library is used only in `scorecard.go` for big.Decimal precision. Custom implementations in `indicators.go` use `float64` for speed.

### 6b. Scoring system

```
CompositeScore = TrendScore × 0.6 + MomentumScore × 0.4

TrendScore (-1 to +1):
  +0.4  if EMA9 > EMA21 > EMA55 (aligned uptrend)
  +0.3  if Supertrend direction == bullish
  +0.3  if close > VWAP
  (mirror for bearish)

MomentumScore (-1 to +1):
  +0.5  if RSI > 50 (bullish territory)
  +0.5  if MACD histogram > 0 (positive momentum)
  (mirror for bearish)
```

Scorecard (techan-based) uses a -5 to +5 scale → recommendation mapping:
```
>= 3  STRONG BUY  |  >= 1  BUY  |  >= -1  HOLD  |  >= -3  SELL  |  < -3  STRONG SELL
```

### 6c. Multi-timeframe analysis

Feature vectors support multiple timeframes for AI consumption:

```go
// Default timeframes: 5m, 15m, 1h, 4h, 1d
// Each timeframe generates an independent FeatureVector
// Layer 9 AI receives all timeframes for cross-TF pattern detection
```

---

## 7. Concurrency Safety

### 7a. Shared state protection

```go
type Engine struct {
    mu            sync.RWMutex                  // protects lastAnalysis
    lastAnalysis  map[string]StockAnalysis       // cache for API queries
    isAnalyzing   atomic.Bool                    // lock-free cycle guard
    results       chan StockAnalysis              // buffered, goroutine-safe
}
```

**Rules:**
- `sync.RWMutex` for read-heavy caches (market sentiment reads >> analysis writes).
- `atomic.Bool` for simple flags — no mutex needed for single booleans.
- Channels for producer-consumer (analysis → collector → Redis publisher).
- Never hold a lock while doing I/O (DB query, Redis publish, HTTP call).

### 7b. Context propagation

Every function that does I/O or spawns goroutines takes `ctx context.Context` as first arg:

```go
func (e *Engine) analyzeStock(ctx context.Context, symbol string) StockAnalysis
func (c *Client) FetchCandles(ctx context.Context, symbol string, limit int) ([]Candle, error)
func (c *Client) Predict(ctx context.Context, symbol string, features []FeatureVector) (*PredictionResponse, error)
```

**Timeout hierarchy:**
```
Engine context (top-level, cancelled on SIGTERM)
  └── analyzeStock context (per-stock, no additional timeout)
        ├── DB query (inherits engine ctx, pgx handles pool timeout)
        └── AI inference (200ms timeout via context.WithTimeout)
```

---

## 8. Error Handling

### Always wrap with context

```go
return fmt.Errorf("fetch candles for %s: %w", symbol, err)
return fmt.Errorf("calculate RSI for %s (period=%d, candles=%d): %w", symbol, period, len(closes), err)
```

### Soft-fail hierarchy

```
CRITICAL (abort cycle): TimescaleDB connection lost → log.Fatal, restart container
MAJOR (skip stock):     DB query fails for one symbol → log error, continue with other 49
MINOR (degrade):        AI inference timeout → log warn, return technical scores only
IGNORABLE:              Redis publish fails → log warn, analysis continues
```

```go
// AI soft-fail pattern
prediction, err := e.aiClient.Predict(ctx, symbol, features)
if err != nil {
    log.Warn().Err(err).Str("symbol", symbol).Msg("AI inference skipped")
    result.AIPrediction = -1
    result.AIConfidence = 0
}
```

### Error checking rules
- Never ignore errors from I/O operations (DB, HTTP, JSON marshal).
- Use `errors.Is()` / `errors.As()` for typed error checking.
- Aggregate with `errors.Join()` when multiple independent operations can fail.

---

## 9. Interface-Driven Design

Every external dependency behind an interface for testability and hot-swapping.

```go
// db package
type CandleFetcher interface {
    FetchCandles(ctx context.Context, symbol string, limit int) ([]Candle, error)
    FetchCandlesTF(ctx context.Context, symbol, interval string, limit int) ([]Candle, error)
    GetAvailableSymbols(ctx context.Context) ([]string, error)
    Close()
}

// redis package
type Publisher interface {
    PublishAnalysis(ctx context.Context, data interface{}) error
    PublishMetrics(ctx context.Context, key string, data interface{}) error
    Close() error
}

// ai package
type Predictor interface {
    Predict(ctx context.Context, symbol string, features []FeatureVector) (*PredictionResponse, error)
    AnalyzeMarket(ctx context.Context, summaries []map[string]interface{}) (*MarketAnalysisResponse, error)
}
```

**Rules:**
- Constructors return the interface: `func NewDBClient(ctx) (CandleFetcher, error)`
- Compile-time assertion: `var _ CandleFetcher = (*Client)(nil)`
- Engine struct holds interfaces, not concrete types.

---

## 10. Structured Logging

Use `rs/zerolog` for structured JSON logs.

```go
import zerolog "github.com/rs/zerolog/log"

// Batch summary (Info level)
zerolog.Info().
    Int("stocks", len(symbols)).
    Dur("elapsed", elapsed).
    Int("goroutines", runtime.NumGoroutine()).
    Msg("analysis cycle complete")

// Per-stock detail (Debug level — disabled in production)
zerolog.Debug().
    Str("symbol", symbol).
    Float64("rsi", rsi).
    Float64("composite_score", score).
    Dur("latency", stockElapsed).
    Msg("stock analysis complete")

// Soft failure (Warn level)
zerolog.Warn().Err(err).Str("symbol", symbol).Msg("AI inference skipped")
```

**Rules:**
- Lowercase messages, no trailing punctuation.
- Structured fields only — never `Msgf` string formatting.
- Debug: per-stock indicators. Info: batch summaries. Warn: soft-failures. Error: hard failures.
- Never log DB credentials, API keys, or connection strings.

---

## 11. Profiling & Benchmarks

### pprof endpoint

Always expose pprof in development for CPU/memory profiling:

```go
import _ "net/http/pprof"
// pprof endpoints auto-register on default mux
// Access: go tool pprof http://localhost:8081/debug/pprof/profile?seconds=30
```

### Benchmark indicators

Every indicator function should have a benchmark:

```go
func BenchmarkRSI(b *testing.B) {
    closes := generateRandomCloses(300) // pre-generate outside loop
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        RSI(closes, 14)
    }
}

// Run: go test -bench=. -benchmem ./internal/indicators/
// Target: <1μs per indicator call, 0 allocs/op
```

### Race detector

Always run with race detector during development:
```bash
go test -race ./...
go run -race cmd/main.go
```

---

## 12. Redis Publishing

### Batch publishes with pipeline

Instead of 50 individual round-trips, use a pipeline:

```go
func (c *Client) PublishBatch(ctx context.Context, results []StockAnalysis) error {
    pipe := c.rdb.Pipeline()
    for i := range results {
        data, err := json.Marshal(&results[i])
        if err != nil {
            continue // skip malformed, don't fail batch
        }
        pipe.Publish(ctx, "analysis:updates", data)
    }
    _, err := pipe.Exec(ctx)
    return err
}
```

This reduces 50 Redis round-trips to 1 pipeline flush.

### Result caching

Cache the latest analysis in-memory for API queries (no DB/Redis hit for `/analyze/market`):

```go
e.mu.Lock()
e.lastAnalysis[result.Symbol] = result
e.mu.Unlock()
```

Use `sync.RWMutex` — market sentiment API reads far more often than analysis writes.

---

## 13. API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/analyze?symbol=X` | Single stock scorecard (300 candles, techan) |
| GET | `/analyze/market` | Market sentiment (cached, all 50 stocks) |
| GET | `/analyze/features?symbol=X&timeframes=5m,15m,1h,4h,1d` | Multi-TF feature vectors for AI |
| POST | `/query/dynamic` | Dynamic aggregation (AI fallback, allowlist-validated) |
| GET | `/symbols` | Available symbols from DB |

**Rules:**
- 15s read/write timeout on the HTTP server — never block longer.
- `/analyze/market` reads from in-memory cache, not live computation.
- `/query/dynamic` validates aggregation + field against allowlists before SQL execution.
- All responses are JSON with `Content-Type: application/json`.

---

## 14. Graceful Shutdown

```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

log.Info().Msg("shutting down analysis engine")
engine.Stop()       // 1. Cancel context → all goroutines exit
// Deferred closes:  2. AI client (HTTP) → 3. Redis → 4. DB pool
```

**Rules:**
- `engine.Stop()` cancels context and sets `isAnalyzing = false`.
- All goroutines must check `ctx.Done()` in select and return.
- Close resources in reverse order of creation.
- Give goroutines up to 5s to drain before force-exit.

---

## 15. Configuration

All configuration via environment variables. No config files.

| Variable | Default | Purpose |
|----------|---------|---------|
| `TIMESCALE_URL` | `postgresql://trading:trading123@localhost:5432/nifty50` | DB connection |
| `REDIS_URL` | `localhost:6379` | Redis (supports `redis://` URI) |
| `AI_INFERENCE_URL` | `http://ai-inference:8000` | Layer 9 AI |
| `GO_ENV` | (none) | `local` → localhost overrides |
| `ANALYSIS_INTERVAL` | `60s` | Cycle frequency |
| `ANALYSIS_WORKERS` | `50` | Max concurrent stock analyses |
| `DB_MAX_CONNS` | `60` | pgx pool max connections |

---

## 16. Struct & Naming Conventions

### Struct tags

```go
type StockAnalysis struct {
    Symbol         string  `json:"symbol"`
    LTP            float64 `json:"ltp"`
    RSI            float64 `json:"rsi"`
    CompositeScore float64 `json:"composite_score"`
    AIPrediction   float64 `json:"ai_prediction,omitempty"`
    Latency        string  `json:"latency,omitempty"`
}
```

- JSON tags: `snake_case`. Pointers/slices/maps: `omitempty`. Internal fields: `json:"-"`.

### Naming

| Item | Convention | Example |
|------|-----------|---------|
| Packages | lowercase, single word | `analyzer`, `indicators`, `db` |
| Exported functions | PascalCase | `FetchCandles`, `RSI`, `NewEngine` |
| Unexported functions | camelCase | `analyzeStock`, `calculateTrendScore` |
| Interfaces | Action noun | `CandleFetcher`, `Publisher`, `Predictor` |
| Booleans | is/has/should | `isRunning`, `hasData`, `shouldSkip` |

---

## 17. Security

- **SQL injection**: Parameterized `$1, $2` placeholders via pgx. Never string concatenation.
- **Dynamic queries**: Aggregation and field values checked against allowlists before SQL construction.
- **No secrets in logs**: Never log DB URLs with passwords, API keys, or tokens.
- **Bounded timeouts**: Every external call has a context timeout to prevent resource exhaustion.
- **Input validation**: Symbol names validated against known list before DB queries.

---

## 18. Coding Standards Checklist

- [ ] `go fmt ./...`
- [ ] `go vet ./...`
- [ ] `golangci-lint run`
- [ ] `go test -race ./...`
- [ ] `ctx context.Context` as first param on all I/O functions
- [ ] All errors wrapped: `fmt.Errorf("context: %w", err)`
- [ ] All slices pre-allocated: `make([]T, 0, cap)` or `make([]T, n)`
- [ ] Pointer receivers on all methods
- [ ] JSON struct tags on all exported types
- [ ] No hardcoded connection strings
- [ ] Graceful shutdown on SIGINT/SIGTERM
- [ ] Semaphore-bounded goroutine spawning
- [ ] sync.RWMutex for shared caches, atomic.Bool for flags
- [ ] Benchmarks for all indicator functions
