// Package db provides TimescaleDB connection and candle fetching via Bun ORM
package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

// Candle represents OHLCV data
type Candle struct {
	bun.BaseModel `bun:"table:candles_1m,alias:c"`

	Time   time.Time `bun:"time,pk"`
	Symbol string    `bun:"symbol,pk"`
	Open   float64   `bun:"open"`
	High   float64   `bun:"high"`
	Low    float64   `bun:"low"`
	Close  float64   `bun:"close"`
	Volume int64     `bun:"volume"`
}

// Client is the TimescaleDB client wrapping Bun DB
type Client struct {
	db *bun.DB
}

// NewClient creates a new TimescaleDB client with Bun
func NewClient(ctx context.Context) (*Client, error) {
	dsn := os.Getenv("TIMESCALE_URL")
	if dsn == "" {
		dsn = "postgres://trading:trading123@localhost:5432/nifty50?sslmode=disable"
	}

	// For local dev override
	if os.Getenv("GO_ENV") == "local" {
		dsn = "postgres://trading:trading123@localhost:5432/nifty50?sslmode=disable"
	}

	// Use pgdriver which supports pgx internally
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))

	// Create Bun DB instance
	db := bun.NewDB(sqldb, pgdialect.New())

	// Configure pool
	db.SetMaxOpenConns(40)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping TimescaleDB: %w", err)
	}

	// Add query hook for debugging in dev
	// db.AddQueryHook(bundebug.NewQueryHook(bundebug.WithVerbose(true)))

	return &Client{db: db}, nil
}

// FetchCandles retrieves candles for a symbol from candles_1m
func (c *Client) FetchCandles(ctx context.Context, symbol string, limit int) ([]Candle, error) {
	var candles []Candle
	err := c.db.NewSelect().
		Model(&candles).
		Where("symbol = ?", symbol).
		Order("time DESC").
		Limit(limit).
		Scan(ctx)

	if err != nil {
		return nil, fmt.Errorf("query failed for %s: %w", symbol, err)
	}

	// Reverse to chronological order
	reverseCandles(candles)
	return candles, nil
}

// GetAvailableSymbols returns list of symbols with data
func (c *Client) GetAvailableSymbols(ctx context.Context) ([]string, error) {
	var symbols []string
	err := c.db.NewSelect().
		Table("candles_1m").
		ColumnExpr("DISTINCT symbol").
		Order("symbol").
		Scan(ctx, &symbols)

	if err != nil {
		return nil, err
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

// FetchCandlesTF retrieves candles for a specific timeframe by dynamically setting the table
func (c *Client) FetchCandlesTF(ctx context.Context, symbol, interval string, limit int) ([]Candle, error) {
	tableName, ok := IntervalTableMap[interval]
	if !ok {
		return nil, fmt.Errorf("unsupported interval: %s", interval)
	}

	var candles []Candle
	err := c.db.NewSelect().
		Model(&candles).
		ModelTableExpr(tableName). // Override table name
		Where("symbol = ?", symbol).
		Order("time DESC").
		Limit(limit).
		Scan(ctx)

	if err != nil {
		return nil, fmt.Errorf("query failed for %s at %s: %w", symbol, interval, err)
	}

	// Reverse to chronological order
	reverseCandles(candles)
	return candles, nil
}

// DynamicQueryResult holds the result of a dynamic aggregation query
type DynamicQueryResult struct {
	Value  float64   `bun:"value"`
	Bucket time.Time `bun:"bucket"`
}

// ExecuteDynamicQuery runs a safe parameterized aggregation query for AI
func (c *Client) ExecuteDynamicQuery(ctx context.Context, symbol, interval, aggregation, field string, lookback int, groupBy string) ([]DynamicQueryResult, error) {
	tableName, ok := IntervalTableMap[interval]
	if !ok {
		tableName = "candles_15m"
	}

	// Validate inputs (Bun prevents SQL injection, but logic checks are good)
	validAggregations := map[string]bool{"avg": true, "sum": true, "min": true, "max": true, "count": true, "stddev": true}
	validFields := map[string]bool{"open": true, "high": true, "low": true, "close": true, "volume": true}

	if !validAggregations[aggregation] {
		return nil, fmt.Errorf("invalid aggregation: %s", aggregation)
	}
	if !validFields[field] {
		return nil, fmt.Errorf("invalid field: %s", field)
	}

	var results []DynamicQueryResult
	q := c.db.NewSelect().Table(tableName).Where("symbol = ?", symbol)

	if groupBy != "" {
		bucket := "1 hour"
		switch groupBy {
		case "day":
			bucket = "1 day"
		case "week":
			bucket = "1 week"
		}
		// TimescaleDB time_bucket query with grouping
		q = q.ColumnExpr("time_bucket(?, time) AS bucket", bucket).
			ColumnExpr(fmt.Sprintf("%s(%s) AS value", aggregation, field)).
			Group("bucket").
			Order("bucket DESC").
			Limit(lookback)
	} else {
		// Simple aggregation over latest N rows
		// Subquery needed: SELECT avg(close) FROM (SELECT close FROM ... LIMIT N)
		subq := c.db.NewSelect().
			Table(tableName).
			ColumnExpr(field).
			Where("symbol = ?", symbol).
			Order("time DESC").
			Limit(lookback)

		q = c.db.NewSelect().
			ColumnExpr(fmt.Sprintf("%s(%s) AS value", aggregation, field)).
			TableExpr("(?) AS sub", subq)
	}

	if err := q.Scan(ctx, &results); err != nil {
		return nil, fmt.Errorf("dynamic query failed: %w", err)
	}

	return results, nil
}

// FetchLatestPrice returns the most recent 1m candle for a symbol
func (c *Client) FetchLatestPrice(ctx context.Context, symbol string) (*Candle, error) {
	var candle Candle
	err := c.db.NewSelect().
		Model(&candle).
		Where("symbol = ?", symbol).
		Order("time DESC").
		Limit(1).
		Scan(ctx)

	if err != nil {
		return nil, fmt.Errorf("fetch latest price for %s: %w", symbol, err)
	}
	return &candle, nil
}

// FetchPreviousClose returns the previous day's closing price
func (c *Client) FetchPreviousClose(ctx context.Context, symbol string) (float64, error) {
	var closePrice float64
	err := c.db.NewSelect().
		Table("candles_1d").
		Column("close").
		Where("symbol = ?", symbol).
		Order("time DESC").
		Offset(1).
		Limit(1).
		Scan(ctx, &closePrice)

	if err != nil {
		return 0, fmt.Errorf("fetch previous close for %s: %w", symbol, err)
	}
	return closePrice, nil
}

// FetchHistoricalCandles returns up to `days` daily candles in chronological order
func (c *Client) FetchHistoricalCandles(ctx context.Context, symbol string, days int) ([]Candle, error) {
	var candles []Candle
	err := c.db.NewSelect().
		Model(&candles).
		ModelTableExpr("candles_1d").
		Where("symbol = ?", symbol).
		Order("time DESC").
		Limit(days).
		Scan(ctx)

	if err != nil {
		return nil, fmt.Errorf("query historical candles for %s: %w", symbol, err)
	}

	reverseCandles(candles)
	return candles, nil
}

// Close closes the database connection
func (c *Client) Close() {
	if c.db != nil {
		c.db.Close()
	}
}

// Helper: Reverse slice in place
func reverseCandles(candles []Candle) {
	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}
}
