# Layer 5: Aggregation Instructions

## Overview

This layer aggregates the individual stock analysis from Layer 4 to form a "Market View". It calculates Market Breadth, Sector Performance, and Advance-Decline Ratios.

## Development Guidelines

### Go Standards

- **Version**: Go 1.21+
- **Module Name**: `github.com/utkarsh-pandey/nifty50-trading-system/layer-5-aggregation`

### Business Logic

- **Sector Rotation**: Group stocks by sector (Bank, IT, Auto, etc.) and calculate aggregate momentum.
- **Market Breadth**: Count stocks above 20 EMA, 50 EMA, 200 EMA.

### Code Structure

- **Interfaces**: Define interfaces for data sources to easily mock them during testing.
- **Pipeline**:
  1. Fetch L4 results from Redis.
  2. Map results to Sectors.
  3. Calculate aggregates.
  4. Publish to Redis Pub/Sub.

```go
type Aggregator interface {
    CalculateBreadth(stocks []StockResult) BreadthMetrics
    CalculateSectorPerformance(stocks []StockResult) map[string]float64
}
```

## Naming Conventions

- **Metrics**: `AdvanceDeclineRatio`, `SectorMomentumIndex`.
- **Functions**: `Calculate...`, `Fetch...`, `Publish...`.

## Dependencies

- `github.com/redis/go-redis/v9`: Redis client.

## Testing

- **Table-Driven Tests**: Use table-driven tests for validating aggregation logic (e.g., if 30 stocks up, 20 down -> A/D Ratio = 1.5).

```go
func TestCalculateBreadth(t *testing.T) {
    tests := []struct {
        name     string
        input    []StockResult
        expected BreadthMetrics
    }{
        // ... cases
    }
    // ... runner
}
```
