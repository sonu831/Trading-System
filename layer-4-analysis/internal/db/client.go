// Package db provides TimescaleDB connection and candle fetching
package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Candle represents OHLCV data
type Candle struct {
	Time   time.Time
	Symbol string
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume int64
}

// Client is the TimescaleDB client
type Client struct {
	pool *pgxpool.Pool
}

// NewClient creates a new TimescaleDB client
func NewClient(ctx context.Context) (*Client, error) {
	connURL := os.Getenv("TIMESCALE_URL")
	if connURL == "" {
		connURL = "postgresql://trading:trading123@localhost:5432/nifty50"
	}

	pool, err := pgxpool.New(ctx, connURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to TimescaleDB: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping TimescaleDB: %w", err)
	}

	return &Client{pool: pool}, nil
}

// FetchCandles retrieves candles for a symbol from TimescaleDB
func (c *Client) FetchCandles(ctx context.Context, symbol string, limit int) ([]Candle, error) {
	query := `
		SELECT time, symbol, open, high, low, close, volume
		FROM candles_1m
		WHERE symbol = $1
		ORDER BY time DESC
		LIMIT $2
	`

	rows, err := c.pool.Query(ctx, query, symbol, limit)
	if err != nil {
		return nil, fmt.Errorf("query failed for %s: %w", symbol, err)
	}
	defer rows.Close()

	var candles []Candle
	for rows.Next() {
		var candle Candle
		if err := rows.Scan(
			&candle.Time,
			&candle.Symbol,
			&candle.Open,
			&candle.High,
			&candle.Low,
			&candle.Close,
			&candle.Volume,
		); err != nil {
			return nil, err
		}
		candles = append(candles, candle)
	}

	// Reverse to get chronological order (oldest first)
	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}

	return candles, nil
}

// GetAvailableSymbols returns list of symbols with data
func (c *Client) GetAvailableSymbols(ctx context.Context) ([]string, error) {
	query := `SELECT DISTINCT symbol FROM candles_1m ORDER BY symbol`

	rows, err := c.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var symbols []string
	for rows.Next() {
		var symbol string
		if err := rows.Scan(&symbol); err != nil {
			return nil, err
		}
		symbols = append(symbols, symbol)
	}

	return symbols, nil
}

// IntervalTableMap maps interval strings to table names
var IntervalTableMap = map[string]string{
	"1m":  "candles_1m",
	"5m":  "candles_5m",
	"10m": "candles_10m",
	"15m": "candles_15m",
	"30m": "candles_30m",
	"1h":  "candles_1h",
	"4h":  "candles_4h",
	"1d":  "candles_1d",
	"1w":  "candles_weekly",
}

// FetchCandlesTF retrieves candles for a specific timeframe
func (c *Client) FetchCandlesTF(ctx context.Context, symbol, interval string, limit int) ([]Candle, error) {
	tableName, ok := IntervalTableMap[interval]
	if !ok {
		return nil, fmt.Errorf("unsupported interval: %s", interval)
	}

	query := fmt.Sprintf(`
		SELECT time, symbol, open, high, low, close, volume
		FROM %s
		WHERE symbol = $1
		ORDER BY time DESC
		LIMIT $2
	`, tableName)

	rows, err := c.pool.Query(ctx, query, symbol, limit)
	if err != nil {
		return nil, fmt.Errorf("query failed for %s at %s: %w", symbol, interval, err)
	}
	defer rows.Close()

	var candles []Candle
	for rows.Next() {
		var candle Candle
		if err := rows.Scan(
			&candle.Time,
			&candle.Symbol,
			&candle.Open,
			&candle.High,
			&candle.Low,
			&candle.Close,
			&candle.Volume,
		); err != nil {
			return nil, err
		}
		candles = append(candles, candle)
	}

	// Reverse to get chronological order (oldest first)
	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}

	return candles, nil
}

// DynamicQueryResult holds the result of a dynamic aggregation query
type DynamicQueryResult struct {
	Value  float64   `json:"value"`
	Bucket time.Time `json:"bucket,omitempty"`
}

// ExecuteDynamicQuery runs a safe parameterized aggregation query for AI
func (c *Client) ExecuteDynamicQuery(ctx context.Context, symbol, interval, aggregation, field string, lookback int, groupBy string) ([]DynamicQueryResult, error) {
	tableName, ok := IntervalTableMap[interval]
	if !ok {
		tableName = "candles_15m"
	}

	// Validate aggregation and field (prevent SQL injection)
	validAggregations := map[string]bool{"avg": true, "sum": true, "min": true, "max": true, "count": true, "stddev": true}
	validFields := map[string]bool{"open": true, "high": true, "low": true, "close": true, "volume": true}

	if !validAggregations[aggregation] {
		return nil, fmt.Errorf("invalid aggregation: %s", aggregation)
	}
	if !validFields[field] {
		return nil, fmt.Errorf("invalid field: %s", field)
	}

	var query string
	if groupBy != "" {
		bucket := "1 hour"
		switch groupBy {
		case "day":
			bucket = "1 day"
		case "week":
			bucket = "1 week"
		}
		query = fmt.Sprintf(`
			SELECT time_bucket('%s', time) AS bucket, %s(%s) AS value
			FROM %s
			WHERE symbol = $1
			ORDER BY bucket DESC
			LIMIT $2
		`, bucket, aggregation, field, tableName)
	} else {
		query = fmt.Sprintf(`
			SELECT %s(%s) AS value
			FROM (
				SELECT %s FROM %s
				WHERE symbol = $1
				ORDER BY time DESC
				LIMIT $2
			) sub
		`, aggregation, field, field, tableName)
	}

	rows, err := c.pool.Query(ctx, query, symbol, lookback)
	if err != nil {
		return nil, fmt.Errorf("dynamic query failed: %w", err)
	}
	defer rows.Close()

	var results []DynamicQueryResult
	for rows.Next() {
		var result DynamicQueryResult
		if groupBy != "" {
			if err := rows.Scan(&result.Bucket, &result.Value); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&result.Value); err != nil {
				return nil, err
			}
		}
		results = append(results, result)
	}

	return results, nil
}

// Close closes the database connection
func (c *Client) Close() {
	if c.pool != nil {
		c.pool.Close()
	}
}
