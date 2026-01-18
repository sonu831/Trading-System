// Package analyzer provides the core analysis engine
// that processes 50 stocks in parallel using goroutines
package analyzer

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/db"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/indicators"
)

// Nifty50 stocks list
var Nifty50Symbols = []string{
	"RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
	"HINDUNILVR", "SBIN", "BHARTIARTL", "KOTAKBANK", "ITC",
	"LT", "AXISBANK", "BAJFINANCE", "ASIANPAINT", "MARUTI",
	"HCLTECH", "TITAN", "WIPRO", "SUNPHARMA", "ULTRACEMCO",
	"ONGC", "NTPC", "POWERGRID", "TATAMOTORS", "M&M",
	"BAJAJFINSV", "ADANIPORTS", "COALINDIA", "TATASTEEL", "TECHM",
	"JSWSTEEL", "INDUSINDBK", "HINDALCO", "DRREDDY", "DIVISLAB",
	"CIPLA", "GRASIM", "BRITANNIA", "NESTLEIND", "EICHERMOT",
	"APOLLOHOSP", "BPCL", "HEROMOTOCO", "SBILIFE", "HDFCLIFE",
	"BAJAJ-AUTO", "TATACONSUM", "ADANIENT", "LTIM", "SHRIRAMFIN",
}

// StockAnalysis represents the complete analysis result for a stock
type StockAnalysis struct {
	Symbol         string                      `json:"symbol"`
	Timestamp      time.Time                   `json:"timestamp"`
	LTP            float64                     `json:"ltp"`
	Change         float64                     `json:"change"`
	ChangePct      float64                     `json:"change_pct"`
	RSI            float64                     `json:"rsi"`
	MACD           indicators.MACDResult       `json:"macd"`
	EMAs           map[int]float64             `json:"emas"`
	ATR            float64                     `json:"atr"`
	VWAP           float64                     `json:"vwap"`
	Supertrend     indicators.SupertrendResult `json:"supertrend"`
	Bollinger      indicators.BollingerResult  `json:"bollinger"`
	TrendScore     float64                     `json:"trend_score"`
	MomentumScore  float64                     `json:"momentum_score"`
	CompositeScore float64                     `json:"composite_score"`
	LatencyMs      int64                       `json:"latency_ms"`
}

// Engine is the main analysis engine
type Engine struct {
	ctx      context.Context
	cancel   context.CancelFunc
	workers  int
	results  chan StockAnalysis
	wg       sync.WaitGroup
	running  bool
	mu       sync.Mutex
	dbClient *db.Client
	symbols  []string
}

// NewEngine creates a new analysis engine
func NewEngine(ctx context.Context) (*Engine, error) {
	ctx, cancel := context.WithCancel(ctx)

	// Connect to TimescaleDB
	dbClient, err := db.NewClient(ctx)
	if err != nil {
		cancel()
		return nil, err
	}

	// Get available symbols from DB
	symbols, err := dbClient.GetAvailableSymbols(ctx)
	if err != nil {
		log.Printf("⚠️ Could not fetch symbols from DB, using defaults: %v", err)
		symbols = Nifty50Symbols
	}

	log.Printf("📊 Found %d symbols in database", len(symbols))

	return &Engine{
		ctx:      ctx,
		cancel:   cancel,
		workers:  50,
		results:  make(chan StockAnalysis, 100),
		dbClient: dbClient,
		symbols:  symbols,
	}, nil
}

// Start begins the analysis engine
func (e *Engine) Start() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.running {
		return nil
	}

	e.running = true

	// Start result collector
	go e.collectResults()

	// Start the analysis loop
	go e.analysisLoop()

	return nil
}

// analysisLoop triggers analysis on every new candle
func (e *Engine) analysisLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	// Run immediately once
	e.runAnalysis()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.runAnalysis()
		}
	}
}

// runAnalysis performs parallel analysis of all stocks
func (e *Engine) runAnalysis() {
	startTime := time.Now()
	log.Printf("📊 Starting analysis of %d stocks...", len(e.symbols))

	var wg sync.WaitGroup

	// Fan-out: Start a goroutine for each stock
	for _, symbol := range e.symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()
			e.analyzeStock(sym)
		}(symbol)
	}

	// Wait for all goroutines to complete (Barrier)
	wg.Wait()

	elapsed := time.Since(startTime)
	log.Printf("✅ Analysis completed in %v for %d stocks", elapsed, len(e.symbols))
}

// analyzeStock performs analysis for a single stock
func (e *Engine) analyzeStock(symbol string) {
	startTime := time.Now()

	// TODO: Fetch candle data from Redis
	candles := e.fetchCandles(symbol)

	if len(candles) < 200 {
		return // Not enough data
	}

	closes := extractCloses(candles)
	highs := extractHighs(candles)
	lows := extractLows(candles)
	volumes := extractVolumes(candles)

	// ========================================
	// WAVE 1: Independent indicators (parallel)
	// ========================================
	var wg sync.WaitGroup
	var rsi float64
	var emas map[int]float64
	var atr float64
	var vwap float64
	var bollinger indicators.BollingerResult

	wg.Add(5)

	// RSI
	go func() {
		defer wg.Done()
		rsi = indicators.RSI(closes, 14)
	}()

	// EMAs
	go func() {
		defer wg.Done()
		emas = make(map[int]float64)
		for _, period := range []int{9, 21, 55, 200} {
			emas[period] = indicators.EMA(closes, period)
		}
	}()

	// ATR
	go func() {
		defer wg.Done()
		atr = indicators.ATR(highs, lows, closes, 14)
	}()

	// VWAP
	go func() {
		defer wg.Done()
		vwap = indicators.VWAP(highs, lows, closes, volumes)
	}()

	// Bollinger Bands
	go func() {
		defer wg.Done()
		bollinger = indicators.BollingerBands(closes, 20, 2.0)
	}()

	wg.Wait()

	// ========================================
	// WAVE 2: Dependent indicators
	// ========================================
	macd := indicators.MACD(closes, 12, 26, 9)
	supertrend := indicators.Supertrend(highs, lows, closes, 10, 3.0)

	// ========================================
	// WAVE 3: Calculate composite scores
	// ========================================
	ltp := closes[len(closes)-1]
	prevClose := closes[len(closes)-2]
	change := ltp - prevClose
	changePct := (change / prevClose) * 100

	trendScore := calculateTrendScore(ltp, emas, supertrend)
	momentumScore := calculateMomentumScore(rsi, macd)
	compositeScore := (trendScore*0.6 + momentumScore*0.4)

	// Build result
	analysis := StockAnalysis{
		Symbol:         symbol,
		Timestamp:      time.Now(),
		LTP:            ltp,
		Change:         change,
		ChangePct:      changePct,
		RSI:            rsi,
		MACD:           macd,
		EMAs:           emas,
		ATR:            atr,
		VWAP:           vwap,
		Supertrend:     supertrend,
		Bollinger:      bollinger,
		TrendScore:     trendScore,
		MomentumScore:  momentumScore,
		CompositeScore: compositeScore,
		LatencyMs:      time.Since(startTime).Milliseconds(),
	}

	// Send to results channel
	select {
	case e.results <- analysis:
	default:
		// Channel full, drop result
	}
}

// fetchCandles retrieves candle data from TimescaleDB
func (e *Engine) fetchCandles(symbol string) []Candle {
	dbCandles, err := e.dbClient.FetchCandles(e.ctx, symbol, 300)
	if err != nil {
		log.Printf("⚠️ Failed to fetch candles for %s: %v", symbol, err)
		return nil
	}

	// Convert db.Candle to analyzer.Candle
	candles := make([]Candle, len(dbCandles))
	for i, c := range dbCandles {
		candles[i] = Candle{
			Time:   c.Time,
			Open:   c.Open,
			High:   c.High,
			Low:    c.Low,
			Close:  c.Close,
			Volume: c.Volume,
		}
	}

	return candles
}

// collectResults collects and publishes analysis results
func (e *Engine) collectResults() {
	for {
		select {
		case <-e.ctx.Done():
			return
		case result := <-e.results:
			// TODO: Publish to Redis
			log.Printf("📈 %s: Score=%.2f, RSI=%.1f, Trend=%s",
				result.Symbol,
				result.CompositeScore,
				result.RSI,
				getTrendLabel(result.Supertrend.Direction),
			)
		}
	}
}

// Stop gracefully stops the engine
func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.running {
		return
	}

	e.cancel()
	e.running = false
}

// Helper functions
func calculateTrendScore(ltp float64, emas map[int]float64, st indicators.SupertrendResult) float64 {
	score := 0.0

	// EMA alignment
	if ltp > emas[9] && emas[9] > emas[21] && emas[21] > emas[55] {
		score += 0.4 // Bullish alignment
	} else if ltp < emas[9] && emas[9] < emas[21] && emas[21] < emas[55] {
		score -= 0.4 // Bearish alignment
	}

	// Supertrend direction
	if st.Direction > 0 {
		score += 0.3
	} else {
		score -= 0.3
	}

	// Price vs VWAP would go here

	// Clamp to -1 to +1
	if score > 1 {
		score = 1
	} else if score < -1 {
		score = -1
	}

	return score
}

func calculateMomentumScore(rsi float64, macd indicators.MACDResult) float64 {
	score := 0.0

	// RSI
	if rsi > 60 {
		score += 0.3
	} else if rsi < 40 {
		score -= 0.3
	}

	// MACD
	if macd.Histogram > 0 {
		score += 0.2
	} else {
		score -= 0.2
	}

	return score
}

func getTrendLabel(direction int) string {
	if direction > 0 {
		return "BULLISH"
	}
	return "BEARISH"
}

// Candle represents OHLCV data
type Candle struct {
	Time   time.Time
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume int64
}

func extractCloses(candles []Candle) []float64 {
	result := make([]float64, len(candles))
	for i, c := range candles {
		result[i] = c.Close
	}
	return result
}

func extractHighs(candles []Candle) []float64 {
	result := make([]float64, len(candles))
	for i, c := range candles {
		result[i] = c.High
	}
	return result
}

func extractLows(candles []Candle) []float64 {
	result := make([]float64, len(candles))
	for i, c := range candles {
		result[i] = c.Low
	}
	return result
}

func extractVolumes(candles []Candle) []float64 {
	result := make([]float64, len(candles))
	for i, c := range candles {
		result[i] = float64(c.Volume)
	}
	return result
}

func generateMockCandles(count int) []Candle {
	candles := make([]Candle, count)
	basePrice := 2500.0

	for i := 0; i < count; i++ {
		candles[i] = Candle{
			Time:   time.Now().Add(time.Duration(-count+i) * time.Minute),
			Open:   basePrice + float64(i%10),
			High:   basePrice + float64(i%10) + 5,
			Low:    basePrice + float64(i%10) - 5,
			Close:  basePrice + float64(i%10) + 2,
			Volume: int64(100000 + i*1000),
		}
	}

	return candles
}
