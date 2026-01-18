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

// Close closes the database connection
func (c *Client) Close() {
	if c.pool != nil {
		c.pool.Close()
	}
}
