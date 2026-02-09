// Package analyzer provides the core analysis engine
// that processes 50 stocks in parallel using goroutines
package analyzer

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sonu831/Trading-System/layer-4-analysis/internal/ai"
	"github.com/sonu831/Trading-System/layer-4-analysis/internal/db"
	"github.com/sonu831/Trading-System/layer-4-analysis/internal/indicators"
	redisClient "github.com/sonu831/Trading-System/layer-4-analysis/internal/redis"
)

// Stock represents a stock entry from the shared JSON
type StockEntry struct {
	Symbol   string            `json:"symbol"`
	Exchange string            `json:"exchange"`
	Sector   string            `json:"sector"`
	Tokens   map[string]string `json:"tokens"`
}

// API response for /api/v1/stocks/symbols
type SymbolsAPIResponse struct {
	Success bool     `json:"success"`
	Count   int      `json:"count"`
	Symbols []string `json:"symbols"`
}

// Nifty50Symbols - loaded from Layer 7 API (preferred) or shared JSON (fallback)
var Nifty50Symbols = loadNifty50Symbols()

// loadNifty50Symbols implements hybrid data access:
// 1. Try Layer 7 API (single source of truth)
// 2. Fall back to shared JSON file
func loadNifty50Symbols() []string {
	// 1. Try Layer 7 API first (hybrid pattern per architecture plan)
	if symbols := loadSymbolsFromAPI(); len(symbols) > 0 {
		return symbols
	}

	// 2. Fall back to JSON file
	if symbols := loadSymbolsFromJSON(); len(symbols) > 0 {
		return symbols
	}

	// No fallback - both sources must be available
	log.Printf("❌ FATAL: Could not load symbols from API or JSON. Check Layer 7 API or shared/stocks/nifty50_shared.json")
	return []string{} // Empty, but allow startup to continue for debugging
}

// loadSymbolsFromAPI fetches symbols from Layer 7 API
func loadSymbolsFromAPI() []string {
	apiURL := os.Getenv("BACKEND_API_URL")
	if apiURL == "" {
		apiURL = "http://backend-api:4000" // Docker default
	}

	// For local dev
	if os.Getenv("GO_ENV") == "local" {
		apiURL = "http://localhost:4000"
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(apiURL + "/api/v1/stocks/symbols")
	if err != nil {
		log.Printf("⚠️ API unavailable, falling back to JSON: %v", err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("⚠️ API returned %d, falling back to JSON", resp.StatusCode)
		return nil
	}

	var apiResp SymbolsAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		log.Printf("⚠️ Failed to parse API response: %v", err)
		return nil
	}

	log.Printf("✅ Loaded %d symbols from Layer 7 API", len(apiResp.Symbols))
	return apiResp.Symbols
}

// loadSymbolsFromJSON loads from shared JSON file
func loadSymbolsFromJSON() []string {
	paths := []string{
		"/app/shared/stocks/nifty50_shared.json",     // Docker path
		"../../shared/stocks/nifty50_shared.json",    // Local dev path
		"../../../shared/stocks/nifty50_shared.json", // Alternative local path
	}

	var data []byte
	var err error
	for _, path := range paths {
		data, err = ioutil.ReadFile(path)
		if err == nil {
			break
		}
	}

	if err != nil {
		return nil
	}

	var stocks []StockEntry
	if err := json.Unmarshal(data, &stocks); err != nil {
		return nil
	}

	symbols := make([]string, len(stocks))
	for i, s := range stocks {
		symbols[i] = s.Symbol
	}
	log.Printf("✅ Loaded %d symbols from shared JSON", len(symbols))
	return symbols
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

	// AI Fields
	AIPrediction   float64 `json:"ai_prediction"`
	AIConfidence   float64 `json:"ai_confidence"`
	AIModelVersion string  `json:"ai_model_version"`
	AIReasoning    string  `json:"ai_reasoning"`
}

// Engine is the main analysis engine
type Engine struct {
	ctx      context.Context
	cancel   context.CancelFunc
	workers  int
	results  chan StockAnalysis
	wg       sync.WaitGroup
	isAnalyzing atomic.Bool  // Lock-free cycle guard (§3c)
	mu       sync.RWMutex   // RWMutex for read-heavy cache (§7a)
	dbClient *db.Client
	redis    *redisClient.Client
	aiClient *ai.Client
	symbols  []string

	// Cache for Market Sentiment (§12)
	lastAnalysis map[string]StockAnalysis
}

// GetMarketSentiment is exposed on Engine struct directly
// No interface needed as we pass *Engine into API
func (e *Engine) GetDBClient() *db.Client {
	return e.dbClient
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

	// Connect to Redis
	redis, err := redisClient.NewClient()
	if err != nil {
		dbClient.Close()
		cancel()
		return nil, err
	}

	// Initialize AI Client
	aiClient := ai.NewClient()

	// Use pre-loaded Nifty50Symbols (from API or JSON via hybrid loader)
	symbols := Nifty50Symbols
	log.Printf("📊 Using %d Nifty50 symbols", len(symbols))

	return &Engine{
		ctx:          ctx,
		cancel:       cancel,
		workers:      50,
		results:      make(chan StockAnalysis, 200), // Increased from 100 to prevent overflow
		dbClient:     dbClient,
		redis:        redis,
		aiClient:     aiClient,
		symbols:      symbols,
		lastAnalysis: make(map[string]StockAnalysis),
	}, nil
}

// Start begins the analysis engine
func (e *Engine) Start() error {
	// Start result collector
	go e.collectResults()

	// Start the analysis loop
	go e.analysisLoop()

	return nil
}

// analysisLoop triggers analysis on every new candle
// Implements backpressure pattern per §3c
func (e *Engine) analysisLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	// Run immediately once
	e.runAnalysis(e.ctx)

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			// Backpressure: skip if previous cycle still running (§3c)
			if e.isAnalyzing.Load() {
				log.Println("⚠️ Previous analysis still running, skipping cycle")
				continue
			}
			e.runAnalysis(e.ctx)
		}
	}
}

// runAnalysis performs parallel analysis of all stocks
// Uses semaphore pattern per §3a for bounded concurrency
func (e *Engine) runAnalysis(ctx context.Context) {
	e.isAnalyzing.Store(true)
	defer e.isAnalyzing.Store(false)

	startTime := time.Now()
	log.Printf("📊 Starting analysis of %d stocks...", len(e.symbols))

	// Semaphore: bound concurrency to NumCPU * 4 (§3a)
	sem := make(chan struct{}, runtime.NumCPU()*4)
	var wg sync.WaitGroup

	// Fan-out: Start a goroutine for each stock
	for _, symbol := range e.symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()
			sem <- struct{}{}        // Acquire slot
			defer func() { <-sem }() // Release slot

			// Respect cancellation before expensive work (§3a)
			if ctx.Err() != nil {
				return
			}
			e.analyzeStock(ctx, sym)
		}(symbol)
	}

	// Wait for all goroutines to complete (Barrier)
	wg.Wait()

	elapsed := time.Since(startTime)
	log.Printf("✅ Analysis completed in %v for %d stocks", elapsed, len(e.symbols))
}

// analyzeStock performs analysis for a single stock
// Context propagation per §7b - all I/O functions take ctx as first param
func (e *Engine) analyzeStock(ctx context.Context, symbol string) {
	startTime := time.Now()

	// Fetch candle data from DB
	candles := e.fetchCandles(ctx, symbol)

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

	// ========================================
	// WAVE 4: AI Inference (Layer 9)
	// ========================================
	var aiPred float64
	var aiConf float64
	var aiVer string

	// Create Feature Vector (Simplified for now - using last candle)
	features := []ai.FeatureVector{
		{
			RSI:    rsi,
			MACD:   macd.MACD,
			EMA50:  emas[55], // Using 55 as proxy for medium term if 50 not exact
			EMA200: emas[200],
			Close:  ltp,
			Volume: float64(candles[len(candles)-1].Volume),
		},
	}

	var aiReasoning string

	prediction, err := e.aiClient.Predict(ctx, symbol, features)
	if err != nil {
		// Log but don't fail the whole analysis (Soft fail)
		log.Printf("⚠️ AI Prediction failed for %s: %v", symbol, err)
		aiPred = -1
		aiConf = 0
		aiVer = "N/A"
		aiReasoning = "Analysis unavailable"
	} else {
		aiPred = prediction.Prediction
		aiConf = prediction.Confidence
		aiVer = prediction.ModelVersion
		aiReasoning = prediction.Reasoning
	}

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
		// AI
		AIPrediction:   aiPred,
		AIConfidence:   aiConf,
		AIModelVersion: aiVer,
		AIReasoning:    aiReasoning,
	}

	// Send to results channel
	select {
	case e.results <- analysis:
	default:
		// Channel full, drop result
	}

	// Update cache
	e.mu.Lock()
	e.lastAnalysis[symbol] = analysis
	e.mu.Unlock()
}

// GetMarketSentiment returns aggregated market sentiment with Top Picks
// Uses RLock for read-heavy cache access per §7a
func (e *Engine) GetMarketSentiment() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var allStocks []StockAnalysis
	bullish := 0
	bearish := 0

	for _, analysis := range e.lastAnalysis {
		allStocks = append(allStocks, analysis)
		if analysis.TrendScore > 0 {
			bullish++
		} else {
			bearish++
		}
	}

	// Sort by Composite Score (Descending)
	sort.Slice(allStocks, func(i, j int) bool {
		return allStocks[i].CompositeScore > allStocks[j].CompositeScore
	})

	total := len(allStocks)
	// Sort by Composite Score (Descending)
	sort.Slice(allStocks, func(i, j int) bool {
		return allStocks[i].CompositeScore > allStocks[j].CompositeScore
	})

	// Create simplified list for response AND AI Analysis
	picks := []map[string]interface{}{}
	summaries := []map[string]interface{}{}

	for _, s := range allStocks {
		summary := map[string]interface{}{
			"symbol": s.Symbol,
			"score":  s.CompositeScore,
			"rsi":    s.RSI,
			"trend":  getTrendLabel(s.Supertrend.Direction),
		}
		summaries = append(summaries, summary)
		if len(picks) < 5 && s.CompositeScore > 0 { // Just top 5 picks criteria
			picks = append(picks, summary)
		}
	}
	// Ensure picks is sorted if not already (it was sorted by CompositeScore check above logic depends on loop order which was sorted)
	// Actually allStocks is sorted. So picks are top N.
	// But above loop appends if Score > 0.
	// Let's just take top 5 from allStocks for picks.
	picks = []map[string]interface{}{}
	for i := 0; i < len(allStocks) && i < 5; i++ {
		s := allStocks[i]
		picks = append(picks, map[string]interface{}{
			"symbol": s.Symbol,
			"score":  s.CompositeScore,
			"rsi":    s.RSI,
			"trend":  getTrendLabel(s.Supertrend.Direction),
		})
	}

	// Default Local Sentiment (Fallback)
	sentiment := "Neutral"
	if float64(bullish) > float64(total)*0.6 {
		sentiment = "Bullish"
	} else if float64(bearish) > float64(total)*0.6 {
		sentiment = "Bearish"
	}
	marketSummary := "Market analysis based on technical indicators."

	// Call AI for Advanced Analysis (pass context for timeout handling)
	aiResult, err := e.aiClient.AnalyzeMarket(context.Background(), summaries)
	if err == nil && aiResult != nil {
		log.Printf("🤖 AI Market Analysis: %s", aiResult.Sentiment)
		sentiment = aiResult.Sentiment
		marketSummary = aiResult.Summary
	} else {
		log.Printf("⚠️ AI Market Analysis Failed, using local: %v", err)
	}

	return map[string]interface{}{
		"total_stocks":   total,
		"bullish":        bullish,
		"bearish":        bearish,
		"sentiment":      sentiment,
		"market_summary": marketSummary, // New Field
		"timestamp":      time.Now(),
		"top_picks":      picks,
	}
}

// fetchCandles retrieves candle data from TimescaleDB
// Context propagation per §7b
func (e *Engine) fetchCandles(ctx context.Context, symbol string) []Candle {
	dbCandles, err := e.dbClient.FetchCandles(ctx, symbol, 300)
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
			// Publish to Redis
			if err := e.redis.PublishAnalysis(e.ctx, result); err != nil {
				log.Printf("⚠️ Failed to publish analysis for %s: %v", result.Symbol, err)
			}

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
// Cancels context which signals all goroutines to exit (§14)
func (e *Engine) Stop() {
	e.cancel()
	// Resources are cleaned up via deferred closes in main
}

// PublishRuntimeMetrics publishes runtime metrics like goroutine count
func (e *Engine) PublishRuntimeMetrics(metrics interface{}) error {
	return e.redis.PublishMetrics(e.ctx, "system:layer4:metrics", metrics)
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
