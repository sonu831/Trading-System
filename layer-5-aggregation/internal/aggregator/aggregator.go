// Package aggregator provides the main aggregation engine
package aggregator

import (
	"context"
	"log"
	"math"
	"sync"
	"time"

	"github.com/utkarsh-pandey/nifty50-trading-system/layer-5-aggregation/internal/breadth"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-5-aggregation/internal/db"
	redisClient "github.com/utkarsh-pandey/nifty50-trading-system/layer-5-aggregation/internal/redis"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-5-aggregation/internal/sectors"
)

// MarketView represents the aggregated market state
type MarketView struct {
	Timestamp         time.Time                `json:"timestamp"`
	Breadth           breadth.BreadthMetrics   `json:"breadth"`
	SectorPerformance map[string]SectorMetrics `json:"sector_performance"`
	TopGainers        []StockSummary           `json:"top_gainers"`
	TopLosers         []StockSummary           `json:"top_losers"`
	MostActive        []StockSummary           `json:"most_active"`
	AllStocks         []StockSummary           `json:"all_stocks"`
}

// SectorMetrics represents performance of a sector
type SectorMetrics struct {
	Name          string  `json:"name"`
	StockCount    int     `json:"stock_count"`
	AverageChange float64 `json:"average_change"`
	AverageRSI    float64 `json:"average_rsi"`
	BullishCount  int     `json:"bullish_count"`
	BearishCount  int     `json:"bearish_count"`
	Momentum      string  `json:"momentum"` // STRONG_UP, UP, NEUTRAL, DOWN, STRONG_DOWN
}

// StockSummary represents a stock summary for lists
type StockSummary struct {
	Symbol    string  `json:"symbol"`
	LTP       float64 `json:"ltp"`
	Change    float64 `json:"change"`
	ChangePct float64 `json:"change_pct"`
	RSI       float64 `json:"rsi"`
	Volume    int64   `json:"volume"`
}

// Engine is the main aggregation engine
type Engine struct {
	ctx      context.Context
	cancel   context.CancelFunc
	dbClient *db.Client
	redis    *redisClient.Client
	running  bool
	mu       sync.Mutex
}

// NewEngine creates a new aggregation engine
func NewEngine(ctx context.Context) (*Engine, error) {
	ctx, cancel := context.WithCancel(ctx)

	dbClient, err := db.NewClient(ctx)
	if err != nil {
		cancel()
		return nil, err
	}

	redis, err := redisClient.NewClient()
	if err != nil {
		dbClient.Close()
		cancel()
		return nil, err
	}

	return &Engine{
		ctx:      ctx,
		cancel:   cancel,
		dbClient: dbClient,
		redis:    redis,
	}, nil
}

// Start begins the aggregation loop
func (e *Engine) Start() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.running {
		return nil
	}
	e.running = true

	go e.aggregationLoop()
	return nil
}

// aggregationLoop runs aggregation every minute
func (e *Engine) aggregationLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	// Run immediately
	e.runAggregation()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.runAggregation()
		}
	}
}

// runAggregation performs the aggregation
func (e *Engine) runAggregation() {
	startTime := time.Now()
	log.Println("📊 Starting market aggregation...")

	// Get all symbols
	symbols, err := e.dbClient.GetAvailableSymbols(e.ctx)
	if err != nil {
		log.Printf("❌ Failed to get symbols: %v", err)
		return
	}

	// Fetch and analyze each stock
	var stockResults []breadth.StockResult
	var stockSummaries []StockSummary
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, symbol := range symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()

			result, summary := e.analyzeStock(sym)
			if result != nil {
				mu.Lock()
				stockResults = append(stockResults, *result)
				stockSummaries = append(stockSummaries, *summary)
				mu.Unlock()
			}
		}(symbol)
	}
	wg.Wait()

	if len(stockResults) == 0 {
		log.Println("⚠️ No stock results available")
		return
	}

	// Calculate market breadth
	breadthMetrics := breadth.CalculateBreadth(stockResults)

	// Calculate sector performance
	sectorPerf := e.calculateSectorPerformance(stockResults)

	// Get top movers
	topGainers, topLosers := e.getTopMovers(stockSummaries, 5)

	// Build market view
	marketView := MarketView{
		Timestamp:         time.Now(),
		Breadth:           breadthMetrics,
		SectorPerformance: sectorPerf,
		TopGainers:        topGainers,
		TopLosers:         topLosers,
		AllStocks:         stockSummaries,
	}

	// Publish to Redis
	if err := e.redis.PublishMarketView(e.ctx, "market_view:latest", marketView); err != nil {
		log.Printf("❌ Failed to publish market view: %v", err)
	}

	elapsed := time.Since(startTime)
	log.Printf("✅ Aggregation completed in %v | Sentiment: %s | A/D: %.2f",
		elapsed, breadthMetrics.MarketSentiment, breadthMetrics.AdvanceDecline)
}

// analyzeStock fetches and analyzes a single stock
func (e *Engine) analyzeStock(symbol string) (*breadth.StockResult, *StockSummary) {
	candles, err := e.dbClient.FetchCandles(e.ctx, symbol, 300)
	if err != nil || len(candles) < 50 {
		return nil, nil
	}

	// Extract closes
	closes := make([]float64, len(candles))
	for i, c := range candles {
		closes[i] = c.Close
	}

	ltp := closes[len(closes)-1]
	prevClose := closes[len(closes)-2]
	change := ltp - prevClose
	changePct := (change / prevClose) * 100

	// Simple RSI calculation
	rsi := calculateRSI(closes, 14)

	// EMAs
	emas := map[int]float64{
		9:   calculateEMA(closes, 9),
		21:  calculateEMA(closes, 21),
		50:  calculateEMA(closes, 50),
		200: calculateEMA(closes, 200),
	}

	// Simple scores
	trendScore := 0.0
	if ltp > emas[9] && emas[9] > emas[21] {
		trendScore = 0.5
	} else if ltp < emas[9] && emas[9] < emas[21] {
		trendScore = -0.5
	}

	momentumScore := 0.0
	if rsi > 60 {
		momentumScore = 0.3
	} else if rsi < 40 {
		momentumScore = -0.3
	}

	result := &breadth.StockResult{
		Symbol:         symbol,
		LTP:            ltp,
		Change:         change,
		ChangePct:      changePct,
		RSI:            rsi,
		EMAs:           emas,
		TrendScore:     trendScore,
		MomentumScore:  momentumScore,
		CompositeScore: trendScore*0.6 + momentumScore*0.4,
	}

	summary := &StockSummary{
		Symbol:    symbol,
		LTP:       ltp,
		Change:    change,
		ChangePct: changePct,
		RSI:       rsi,
		Volume:    candles[len(candles)-1].Volume,
	}

	return result, summary
}

// calculateSectorPerformance groups and aggregates by sector
func (e *Engine) calculateSectorPerformance(stocks []breadth.StockResult) map[string]SectorMetrics {
	sectorData := make(map[string][]breadth.StockResult)

	for _, stock := range stocks {
		sector := sectors.GetSector(stock.Symbol)
		sectorData[sector] = append(sectorData[sector], stock)
	}

	result := make(map[string]SectorMetrics)
	for sector, sectorStocks := range sectorData {
		var totalChange, totalRSI float64
		bullish, bearish := 0, 0

		for _, s := range sectorStocks {
			totalChange += s.ChangePct
			totalRSI += s.RSI
			if s.CompositeScore > 0.3 {
				bullish++
			} else if s.CompositeScore < -0.3 {
				bearish++
			}
		}

		n := float64(len(sectorStocks))
		avgChange := totalChange / n
		avgRSI := totalRSI / n

		momentum := "NEUTRAL"
		if avgChange > 1.0 {
			momentum = "STRONG_UP"
		} else if avgChange > 0.3 {
			momentum = "UP"
		} else if avgChange < -1.0 {
			momentum = "STRONG_DOWN"
		} else if avgChange < -0.3 {
			momentum = "DOWN"
		}

		result[sector] = SectorMetrics{
			Name:          sector,
			StockCount:    len(sectorStocks),
			AverageChange: math.Round(avgChange*100) / 100,
			AverageRSI:    math.Round(avgRSI*100) / 100,
			BullishCount:  bullish,
			BearishCount:  bearish,
			Momentum:      momentum,
		}
	}

	return result
}

// getTopMovers returns top gainers and losers
func (e *Engine) getTopMovers(stocks []StockSummary, n int) ([]StockSummary, []StockSummary) {
	if len(stocks) == 0 {
		return nil, nil
	}

	// Sort by change percent
	sorted := make([]StockSummary, len(stocks))
	copy(sorted, stocks)

	// Simple bubble sort for small dataset
	for i := 0; i < len(sorted)-1; i++ {
		for j := 0; j < len(sorted)-i-1; j++ {
			if sorted[j].ChangePct < sorted[j+1].ChangePct {
				sorted[j], sorted[j+1] = sorted[j+1], sorted[j]
			}
		}
	}

	gainers := sorted[:min(n, len(sorted))]
	losers := sorted[max(0, len(sorted)-n):]

	// Reverse losers
	for i, j := 0, len(losers)-1; i < j; i, j = i+1, j-1 {
		losers[i], losers[j] = losers[j], losers[i]
	}

	return gainers, losers
}

// Stop gracefully stops the engine
func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.running {
		return
	}

	e.cancel()
	e.dbClient.Close()
	e.redis.Close()
	e.running = false
}

// PublishRuntimeMetrics publishes runtime metrics like goroutine count
func (e *Engine) PublishRuntimeMetrics(metrics interface{}) error {
	return e.redis.PublishMetrics(e.ctx, "system:layer5:metrics", metrics)
}

// Helper functions
func calculateRSI(closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return 50.0
	}

	gains, losses := 0.0, 0.0
	for i := 1; i <= period; i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			gains += change
		} else {
			losses += -change
		}
	}

	avgGain := gains / float64(period)
	avgLoss := losses / float64(period)

	if avgLoss == 0 {
		return 100.0
	}

	rs := avgGain / avgLoss
	return 100.0 - (100.0 / (1.0 + rs))
}

func calculateEMA(data []float64, period int) float64 {
	if len(data) < period {
		return 0
	}

	multiplier := 2.0 / float64(period+1)
	sma := 0.0
	for i := 0; i < period; i++ {
		sma += data[i]
	}
	sma /= float64(period)

	ema := sma
	for i := period; i < len(data); i++ {
		ema = (data[i]-ema)*multiplier + ema
	}
	return ema
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
