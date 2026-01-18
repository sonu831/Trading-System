# Layer 4: Analysis Engine Instructions

## Overview

This is the core calculation engine of the system. It analyzes all 50 Nifty stocks **simultaneously** using Go's concurrency primitives. It receives candle data from Redis/TimescaleDB and computes technical indicators (RSI, MACD, etc.) and Option Greeks.

## Development Guidelines

### Go Standards

- **Version**: Go 1.21+
- **Module Name**: `github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis`
- **Linter**: Use `golangci-lint` with default settings + `errcheck`, `gocritic`.

### Concurrency Patterns

- **Goroutines**: Spin up one goroutine per stock for parallel analysis.
- **Channels**: Use buffered channels for passing tick data to analysis workers to prevent blocking.
- **Synchronization**: Use `sync.WaitGroup` to wait for all 50 stocks to finish analysis before aggregating the result.
- **Context**: Propagate `context.Context` for cancellation and timeouts.

```go
// Worker Pattern
func Worker(ctx context.Context, jobs <-chan StockData, results chan<- AnalysisResult) {
    for {
        select {
        case <-ctx.Done():
            return
        case stock := <-jobs:
            results <- Analyze(stock)
        }
    }
}
```

### Code Formatting & Style

- **Structuring**:
  - `cmd/` for entry points.
  - `pkg/` for library code (indicators, greeks).
  - `internal/` for private business logic.
- **Error Handling**: Use `errors.Join` (Go 1.20+) or `fmt.Errorf("%w")` for wrapping.

```go
if err := indicator.CalculateRSI(prices); err != nil {
    return fmt.Errorf("failed to calculate RSI for %s: %w", symbol, err)
}
```

### Struct Definitions

- Use strictly typed structs for all indicators.
- JSON tags are required for exporting results to Redis/Frontend.

```go
type AnalysisResult struct {
    Symbol    string  `json:"symbol"`
    RSI       float64 `json:"rsi"`
    MACD      float64 `json:"macd"`
    Trend     string  `json:"trend"` // Bullish, Bearish, Neutral
    Timestamp int64   `json:"timestamp"`
}
```

## Dependencies

- `github.com/redis/go-redis/v9`: Redis client.
- `github.com/markcheno/go-talib`: Technical Analysis library (or custom implementation).

## Testing

- **Unit Tests**: Test indicator math against known values (e.g., TradingView outputs).
- **Benchmarks**: Critical for this layer. Use `go test -bench=.` to ensure calculating indicators for 50 stocks takes < 10ms.

```go
func BenchmarkAnalyzeAll(b *testing.B) {
    for i := 0; i < b.N; i++ {
        AnalyzeAllStocks(mockData)
    }
}
```
