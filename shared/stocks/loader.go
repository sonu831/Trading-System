// Package stocks provides Nifty50 stock data loading utilities
// Single source of truth for stock symbols, sectors, and broker tokens
package stocks

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

// Stock represents a Nifty50 stock with metadata
type Stock struct {
	Symbol   string            `json:"symbol"`
	Exchange string            `json:"exchange"`
	Sector   string            `json:"sector"`
	Tokens   map[string]string `json:"tokens"`
}

// Loader caches and provides stock data
type Loader struct {
	stocks []Stock
	path   string
	once   sync.Once
}

// NewLoader creates a loader for the given JSON path
func NewLoader(jsonPath string) *Loader {
	return &Loader{path: jsonPath}
}

// load reads and caches the JSON data
func (l *Loader) load() error {
	var loadErr error
	l.once.Do(func() {
		data, err := os.ReadFile(l.path)
		if err != nil {
			loadErr = fmt.Errorf("read stock data: %w", err)
			return
		}
		if err := json.Unmarshal(data, &l.stocks); err != nil {
			loadErr = fmt.Errorf("parse stock data: %w", err)
			return
		}
	})
	return loadErr
}

// GetSymbols returns all stock symbols as a slice
func (l *Loader) GetSymbols() ([]string, error) {
	if err := l.load(); err != nil {
		return nil, err
	}
	symbols := make([]string, len(l.stocks))
	for i, s := range l.stocks {
		symbols[i] = s.Symbol
	}
	return symbols, nil
}

// GetAllStocks returns all stock data
func (l *Loader) GetAllStocks() ([]Stock, error) {
	if err := l.load(); err != nil {
		return nil, err
	}
	return l.stocks, nil
}

// GetStockBySymbol returns stock data for a specific symbol
func (l *Loader) GetStockBySymbol(symbol string) (*Stock, error) {
	if err := l.load(); err != nil {
		return nil, err
	}
	for _, s := range l.stocks {
		if s.Symbol == symbol {
			return &s, nil
		}
	}
	return nil, nil // Not found
}

// GetSectorMap returns a map of symbol -> sector
func (l *Loader) GetSectorMap() (map[string]string, error) {
	if err := l.load(); err != nil {
		return nil, err
	}
	sectorMap := make(map[string]string, len(l.stocks))
	for _, s := range l.stocks {
		sectorMap[s.Symbol] = s.Sector
	}
	return sectorMap, nil
}

// GetStocksBySector returns a map of sector -> []symbols
func (l *Loader) GetStocksBySector() (map[string][]string, error) {
	if err := l.load(); err != nil {
		return nil, err
	}
	sectors := make(map[string][]string)
	for _, s := range l.stocks {
		sectors[s.Sector] = append(sectors[s.Sector], s.Symbol)
	}
	return sectors, nil
}

// GetSectors returns all unique sector names
func (l *Loader) GetSectors() ([]string, error) {
	if err := l.load(); err != nil {
		return nil, err
	}
	sectorSet := make(map[string]bool)
	for _, s := range l.stocks {
		sectorSet[s.Sector] = true
	}
	sectors := make([]string, 0, len(sectorSet))
	for sector := range sectorSet {
		sectors = append(sectors, sector)
	}
	return sectors, nil
}

// GetToken returns the broker token for a symbol
func (l *Loader) GetToken(symbol, broker string) (string, error) {
	stock, err := l.GetStockBySymbol(symbol)
	if err != nil {
		return "", err
	}
	if stock == nil {
		return "", nil
	}
	return stock.Tokens[broker], nil
}
