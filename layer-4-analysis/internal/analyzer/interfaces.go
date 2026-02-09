// Package analyzer provides interface definitions for dependency injection
// Following instruction §9: Interface-Driven Design
package analyzer

import (
	"context"
)

// CandleFetcher defines the database operations for fetching candles
// Uses Candle type defined in engine.go
type CandleFetcher interface {
	FetchCandles(ctx context.Context, symbol string, limit int) ([]Candle, error)
	FetchCandlesTF(ctx context.Context, symbol, interval string, limit int) ([]Candle, error)
	GetAvailableSymbols(ctx context.Context) ([]string, error)
	Close()
}

// Publisher defines Redis publishing operations
type Publisher interface {
	PublishAnalysis(ctx context.Context, data interface{}) error
	PublishBatch(ctx context.Context, results []StockAnalysis) error
	PublishMetrics(ctx context.Context, key string, data interface{}) error
	Close() error
}

// Predictor defines AI inference operations
// Uses FeatureVector and PredictionResponse from ai package
type Predictor interface {
	Predict(ctx context.Context, symbol string, features interface{}) (interface{}, error)
}

// Compile-time interface assertions would go here
// var _ CandleFetcher = (*db.Client)(nil) // when db.Client returns []Candle
