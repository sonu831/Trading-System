package api

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	_ "net/http/pprof" // pprof endpoints per instruction §11
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sonu831/Trading-System/layer-4-analysis/internal/analyzer"
	"github.com/sonu831/Trading-System/layer-4-analysis/internal/db"
	"github.com/sonu831/Trading-System/layer-4-analysis/internal/indicators"
)

type Server struct {
	router *mux.Router
	engine *analyzer.Engine
}

func NewServer(engine *analyzer.Engine) *Server {
	s := &Server{
		router: mux.NewRouter(),
		engine: engine,
	}

	s.routes()
	return s
}

func (s *Server) routes() {
	// Profiling endpoints per instruction §11
	s.router.PathPrefix("/debug/pprof/").Handler(http.DefaultServeMux)

	s.router.Handle("/metrics", promhttp.Handler())
	s.router.HandleFunc("/health", s.handleHealth).Methods("GET")
	s.router.HandleFunc("/analyze", s.handleAnalyze).Methods("GET")
	s.router.HandleFunc("/analyze/market", s.handleMarketSentiment).Methods("GET")

	// Chart-ready full analysis endpoints
	s.router.HandleFunc("/analyze/full/{symbol}", s.handleFullAnalysis).Methods("GET")
	s.router.HandleFunc("/analyze/multi-tf/{symbol}", s.handleMultiTFVerdict).Methods("GET")
	s.router.HandleFunc("/analyze/overview/{symbol}", s.handleOverview).Methods("GET")
	s.router.HandleFunc("/analyze/backtest/{symbol}", s.handleBacktest).Methods("GET")

	// AI Service Endpoints
	s.router.HandleFunc("/analyze/features", s.handleAIFeatures).Methods("GET")
	s.router.HandleFunc("/query/dynamic", s.handleDynamicQuery).Methods("POST")
	s.router.HandleFunc("/symbols", s.handleSymbols).Methods("GET")
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleMarketSentiment(w http.ResponseWriter, r *http.Request) {
	sentiment := s.engine.GetMarketSentiment()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sentiment)
}

func (s *Server) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		http.Error(w, "symbol parameter is required", http.StatusBadRequest)
		return
	}

	// Fetch 300 candles (enough for EMA200)
	candles, err := s.engine.GetDBClient().FetchCandles(r.Context(), symbol, 300)
	if err != nil {
		log.Printf("Error fetching candles for %s: %v", symbol, err)
		http.Error(w, "failed to fetch data", http.StatusInternalServerError)
		return
	}

	if len(candles) < 200 {
		http.Error(w, "insufficient data for analysis", http.StatusBadRequest)
		return
	}

	scorecard, err := indicators.GenerateScorecard(symbol, candles)
	if err != nil {
		log.Printf("Error generating scorecard for %s: %v", symbol, err)
		http.Error(w, "internal analysis error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scorecard)
}

// featureResult holds a single timeframe's feature vector (used by concurrent fan-out).
type featureResult struct {
	tf      string
	feature indicators.FeatureVector
}

// handleAIFeatures returns multi-timeframe indicators for AI consumption.
// Uses concurrent goroutines per copilot §3.
func (s *Server) handleAIFeatures(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		http.Error(w, "symbol parameter is required", http.StatusBadRequest)
		return
	}

	timeframesParam := r.URL.Query().Get("timeframes")
	if timeframesParam == "" {
		timeframesParam = "5m,15m,1h,4h,1d"
	}
	timeframes := strings.Split(timeframesParam, ",")

	ch := make(chan featureResult, len(timeframes))
	var wg sync.WaitGroup

	for _, tf := range timeframes {
		tf = strings.TrimSpace(tf)
		wg.Add(1)
		go func(tf string) {
			defer wg.Done()
			candles, err := s.engine.GetDBClient().FetchCandlesTF(r.Context(), symbol, tf, 200)
			if err != nil {
				log.Printf("Error fetching %s candles for %s: %v", tf, symbol, err)
				ch <- featureResult{tf: tf, feature: indicators.FeatureVector{
					Interval: tf,
					Trend:    indicators.TrendInfo{Direction: "ERROR", Strength: 0},
				}}
				return
			}
			ch <- featureResult{tf: tf, feature: indicators.GenerateFeatureVector(tf, candles)}
		}(tf)
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	features := make(map[string]indicators.FeatureVector, len(timeframes))
	for r := range ch {
		features[r.tf] = r.feature
	}

	response := map[string]interface{}{
		"success":   true,
		"symbol":    symbol,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"features":  features,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DynamicQueryRequest represents the request body for dynamic queries
type DynamicQueryRequest struct {
	Symbol      string `json:"symbol"`
	Interval    string `json:"interval"`
	Aggregation string `json:"aggregation"`
	Field       string `json:"field"`
	Lookback    int    `json:"lookback"`
	GroupBy     string `json:"groupBy"`
}

// handleDynamicQuery executes parameterized aggregation queries for AI fallback
func (s *Server) handleDynamicQuery(w http.ResponseWriter, r *http.Request) {
	var req DynamicQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Symbol == "" {
		http.Error(w, "symbol is required", http.StatusBadRequest)
		return
	}
	if req.Aggregation == "" {
		req.Aggregation = "avg"
	}
	if req.Field == "" {
		req.Field = "close"
	}
	if req.Lookback == 0 {
		req.Lookback = 100
	}
	if req.Interval == "" {
		req.Interval = "15m"
	}

	results, err := s.engine.GetDBClient().ExecuteDynamicQuery(
		r.Context(),
		req.Symbol,
		req.Interval,
		req.Aggregation,
		req.Field,
		req.Lookback,
		req.GroupBy,
	)
	if err != nil {
		log.Printf("Dynamic query error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"query":   req,
		"result":  results,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleSymbols returns list of all available symbols
func (s *Server) handleSymbols(w http.ResponseWriter, r *http.Request) {
	symbols, err := s.engine.GetDBClient().GetAvailableSymbols(r.Context())
	if err != nil {
		log.Printf("Error fetching symbols: %v", err)
		http.Error(w, "failed to fetch symbols", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"count":   len(symbols),
		"symbols": symbols,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleFullAnalysis returns chart-ready indicator arrays for a single symbol/timeframe.
// GET /analyze/full/{symbol}?interval=15m&limit=500
func (s *Server) handleFullAnalysis(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]
	if symbol == "" {
		http.Error(w, "symbol parameter is required", http.StatusBadRequest)
		return
	}

	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "15m"
	}

	if _, ok := db.IntervalTableMap[interval]; !ok {
		http.Error(w, "unsupported interval: "+interval, http.StatusBadRequest)
		return
	}

	limit := parseIntParam(r.URL.Query().Get("limit"), 500)
	if limit > 1000 {
		limit = 1000
	}

	candles, err := s.engine.GetDBClient().FetchCandlesTF(r.Context(), symbol, interval, limit)
	if err != nil {
		log.Printf("Error fetching %s candles for %s: %v", interval, symbol, err)
		http.Error(w, "failed to fetch data", http.StatusInternalServerError)
		return
	}

	if len(candles) < 14 {
		http.Error(w, "insufficient data for analysis", http.StatusBadRequest)
		return
	}

	result := indicators.GenerateFullAnalysis(symbol, interval, candles)
	if result == nil {
		http.Error(w, "analysis generation failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// tfResult holds the analysis output for one timeframe (used by concurrent fan-out).
type tfResult struct {
	tf   string
	data map[string]interface{}
}

// handleMultiTFVerdict returns 6-timeframe verdicts for a symbol.
// Uses concurrent goroutines per copilot §3 (fan-out/fan-in).
// GET /analyze/multi-tf/{symbol}
func (s *Server) handleMultiTFVerdict(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]
	if symbol == "" {
		http.Error(w, "symbol parameter is required", http.StatusBadRequest)
		return
	}

	intervals := []string{"5m", "15m", "1h", "4h", "1d", "1w"}
	results := make(chan tfResult, len(intervals))
	var wg sync.WaitGroup

	for _, tf := range intervals {
		wg.Add(1)
		go func(tf string) {
			defer wg.Done()

			noData := map[string]interface{}{
				"verdict": map[string]interface{}{"signal": "No Data", "confidence": 0},
				"rsi":     nil,
				"trend":   "Unknown",
			}

			candles, err := s.engine.GetDBClient().FetchCandlesTF(r.Context(), symbol, tf, 100)
			if err != nil || len(candles) < 14 {
				results <- tfResult{tf: tf, data: noData}
				return
			}

			result := indicators.GenerateFullAnalysis(symbol, tf, candles)
			if result == nil {
				results <- tfResult{tf: tf, data: noData}
				return
			}

			// Extract last MACD histogram
			var macdHist interface{}
			if n := len(result.Indicators.MACD.Histogram); n > 0 && result.Indicators.MACD.Histogram[n-1] != nil {
				macdHist = *result.Indicators.MACD.Histogram[n-1]
			}

			// Extract last supertrend direction
			var stDir interface{}
			if n := len(result.Indicators.Supertrend.Direction); n > 0 && result.Indicators.Supertrend.Direction[n-1] != nil {
				d := *result.Indicators.Supertrend.Direction[n-1]
				if d == 1 {
					stDir = "Bullish"
				} else {
					stDir = "Bearish"
				}
			}

			results <- tfResult{tf: tf, data: map[string]interface{}{
				"verdict":       result.Verdict,
				"rsi":           result.Summary.LatestRSI,
				"macdHistogram": macdHist,
				"supertrend":    stDir,
				"trend":         result.Summary.TrendState,
			}}
		}(tf)
	}

	// Close results channel after all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	summary := make(map[string]interface{}, len(intervals))
	for r := range results {
		summary[r.tf] = r.data
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"symbol":     symbol,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"timeframes": summary,
	})
}

// handleOverview returns stock overview: price, change, RSI, signal badge.
// GET /analyze/overview/{symbol}
func (s *Server) handleOverview(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]
	if symbol == "" {
		http.Error(w, "symbol parameter is required", http.StatusBadRequest)
		return
	}

	dbClient := s.engine.GetDBClient()

	// Fetch latest price and previous close concurrently
	type priceResult struct {
		latest    *db.Candle
		prevClose float64
		err       error
	}
	latestCh := make(chan priceResult, 1)
	prevCh := make(chan priceResult, 1)

	go func() {
		latest, err := dbClient.FetchLatestPrice(r.Context(), symbol)
		latestCh <- priceResult{latest: latest, err: err}
	}()
	go func() {
		pc, err := dbClient.FetchPreviousClose(r.Context(), symbol)
		prevCh <- priceResult{prevClose: pc, err: err}
	}()

	lr := <-latestCh
	pr := <-prevCh

	if lr.err != nil || lr.latest == nil {
		http.Error(w, "symbol not found", http.StatusNotFound)
		return
	}

	currentPrice := lr.latest.Close
	previousClose := currentPrice
	if pr.err == nil {
		previousClose = pr.prevClose
	}
	change := currentPrice - previousClose
	changePct := 0.0
	if previousClose != 0 {
		changePct = (change / previousClose) * 100
	}

	// Fetch 50 candles for RSI/signal computation
	candles, err := dbClient.FetchCandlesTF(r.Context(), symbol, "15m", 50)
	if err != nil || len(candles) < 14 {
		// Return overview without indicators
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"symbol":      symbol,
			"price":       currentPrice,
			"change":      math.Round(change*100) / 100,
			"changePct":   math.Round(changePct*100) / 100,
			"lastUpdated": lr.latest.Time.Format(time.RFC3339),
			"rsi":         nil,
			"signal":      map[string]string{"signal": "Neutral", "color": "warning"},
		})
		return
	}

	closes := make([]float64, len(candles))
	for i, c := range candles {
		closes[i] = c.Close
	}

	latestRSI := indicators.RSI(closes, 14)
	macd := indicators.MACD(closes, 12, 26, 9)
	badge := indicators.GetOverviewSignalBadge(latestRSI, macd)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"symbol":      symbol,
		"price":       currentPrice,
		"change":      math.Round(change*100) / 100,
		"changePct":   math.Round(changePct*100) / 100,
		"lastUpdated": lr.latest.Time.Format(time.RFC3339),
		"rsi":         math.Round(latestRSI*100) / 100,
		"signal":      badge,
	})
}

// handleBacktest runs historical indicator backtesting.
// GET /analyze/backtest/{symbol}?indicator=rsi&operator=lt&threshold=30
func (s *Server) handleBacktest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := vars["symbol"]
	if symbol == "" {
		http.Error(w, "symbol parameter is required", http.StatusBadRequest)
		return
	}

	indicator := r.URL.Query().Get("indicator")
	operator := r.URL.Query().Get("operator")
	thresholdStr := r.URL.Query().Get("threshold")

	if indicator == "" || operator == "" || thresholdStr == "" {
		http.Error(w, "missing required params: indicator, operator, threshold", http.StatusBadRequest)
		return
	}

	validIndicators := map[string]bool{"rsi": true, "macd_hist": true, "stochastic_k": true, "bb_position": true}
	if !validIndicators[indicator] {
		http.Error(w, "invalid indicator. Valid: rsi, macd_hist, stochastic_k, bb_position", http.StatusBadRequest)
		return
	}

	validOperators := map[string]bool{"lt": true, "gt": true, "lte": true, "gte": true}
	if !validOperators[operator] {
		http.Error(w, "invalid operator. Valid: lt, gt, lte, gte", http.StatusBadRequest)
		return
	}

	threshold, err := strconv.ParseFloat(thresholdStr, 64)
	if err != nil {
		http.Error(w, "threshold must be a number", http.StatusBadRequest)
		return
	}

	candles, err := s.engine.GetDBClient().FetchHistoricalCandles(r.Context(), symbol, 2500)
	if err != nil || len(candles) < 50 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"condition": map[string]interface{}{"indicator": indicator, "operator": operator, "threshold": threshold},
			"signals":   []interface{}{},
			"stats":     nil,
			"message":   "Insufficient historical data",
		})
		return
	}

	n := len(candles)
	closes := make([]float64, n)
	highs := make([]float64, n)
	lows := make([]float64, n)
	for i, c := range candles {
		closes[i] = c.Close
		highs[i] = c.High
		lows[i] = c.Low
	}

	// Compute indicator array
	var indicatorValues []*float64

	switch indicator {
	case "rsi":
		indicatorValues = indicators.RSIArray(closes, 14)
	case "macd_hist":
		macdArr := indicators.MACDArray(closes, 12, 26, 9)
		indicatorValues = macdArr.Histogram
	case "stochastic_k":
		stochArr := indicators.StochasticArray(highs, lows, closes, 14, 3)
		indicatorValues = stochArr.K
	case "bb_position":
		bbArr := indicators.BollingerBandsArray(closes, 20, 2.0)
		indicatorValues = make([]*float64, n)
		for i := 0; i < n; i++ {
			if bbArr.Upper[i] != nil && bbArr.Lower[i] != nil {
				upper := *bbArr.Upper[i]
				lower := *bbArr.Lower[i]
				width := upper - lower
				pos := 50.0
				if width > 0 {
					pos = ((closes[i] - lower) / width) * 100
				}
				indicatorValues[i] = &pos
			}
		}
	}

	compare := func(value float64, op string, thresh float64) bool {
		switch op {
		case "lt":
			return value < thresh
		case "gt":
			return value > thresh
		case "lte":
			return value <= thresh
		case "gte":
			return value >= thresh
		}
		return false
	}

	type backtestSignal struct {
		Date           string  `json:"date"`
		IndicatorValue string  `json:"indicatorValue"`
		EntryPrice     string  `json:"entryPrice"`
		Return5d       string  `json:"return5d"`
		Return10d      string  `json:"return10d"`
		Return20d      string  `json:"return20d"`
		Return5dNum    float64 `json:"-"`
		Return10dNum   float64 `json:"-"`
		Return20dNum   float64 `json:"-"`
	}

	var signals []backtestSignal

	for i := 1; i < n-20; i++ {
		if indicatorValues[i] == nil {
			continue
		}
		val := *indicatorValues[i]

		prevMatch := false
		if indicatorValues[i-1] != nil {
			prevMatch = compare(*indicatorValues[i-1], operator, threshold)
		}

		if compare(val, operator, threshold) && !prevMatch {
			entry := closes[i]
			r5 := ((closes[i+5] - entry) / entry) * 100
			r10 := ((closes[i+10] - entry) / entry) * 100
			r20 := ((closes[i+20] - entry) / entry) * 100

			signals = append(signals, backtestSignal{
				Date:           candles[i].Time.Format("2006-01-02T15:04:05Z"),
				IndicatorValue: fmt.Sprintf("%.2f", val),
				EntryPrice:     fmt.Sprintf("%.2f", entry),
				Return5d:       fmt.Sprintf("%.2f", r5),
				Return10d:      fmt.Sprintf("%.2f", r10),
				Return20d:      fmt.Sprintf("%.2f", r20),
				Return5dNum:    r5,
				Return10dNum:   r10,
				Return20dNum:   r20,
			})
		}
	}

	condition := map[string]interface{}{"indicator": indicator, "operator": operator, "threshold": threshold}

	if len(signals) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"condition": condition,
			"signals":   []interface{}{},
			"stats":     nil,
			"message":   "No signals found",
		})
		return
	}

	calcStats := func(returns []float64) map[string]interface{} {
		sorted := make([]float64, len(returns))
		copy(sorted, returns)
		sort.Float64s(sorted)

		sum := 0.0
		for _, v := range returns {
			sum += v
		}
		avg := sum / float64(len(returns))
		median := sorted[len(sorted)/2]
		winners := 0
		best := returns[0]
		worst := returns[0]
		for _, v := range returns {
			if v > 0 {
				winners++
			}
			if v > best {
				best = v
			}
			if v < worst {
				worst = v
			}
		}

		return map[string]interface{}{
			"count":        len(returns),
			"avgReturn":    fmt.Sprintf("%.2f", avg),
			"medianReturn": fmt.Sprintf("%.2f", median),
			"winRate":      fmt.Sprintf("%.1f", float64(winners)/float64(len(returns))*100),
			"best":         fmt.Sprintf("%.2f", best),
			"worst":        fmt.Sprintf("%.2f", worst),
		}
	}

	r5d := make([]float64, len(signals))
	r10d := make([]float64, len(signals))
	r20d := make([]float64, len(signals))
	for i, s := range signals {
		r5d[i] = s.Return5dNum
		r10d[i] = s.Return10dNum
		r20d[i] = s.Return20dNum
	}

	// Return last 50 signals
	displaySignals := signals
	if len(displaySignals) > 50 {
		displaySignals = displaySignals[len(displaySignals)-50:]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"condition": condition,
		"signals":   displaySignals,
		"stats": map[string]interface{}{
			"totalSignals": len(signals),
			"period5d":     calcStats(r5d),
			"period10d":    calcStats(r10d),
			"period20d":    calcStats(r20d),
		},
	})
}

func (s *Server) Start(addr string) error {
	srv := &http.Server{
		Handler:      s.router,
		Addr:         addr,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}
	return srv.ListenAndServe()
}

// parseIntParam safely parses an int query parameter
func parseIntParam(val string, defaultVal int) int {
	if val == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return i
}
