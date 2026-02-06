package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/analyzer"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/indicators"
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
	s.router.Handle("/metrics", promhttp.Handler())
	s.router.HandleFunc("/health", s.handleHealth).Methods("GET")
	s.router.HandleFunc("/analyze", s.handleAnalyze).Methods("GET")
	s.router.HandleFunc("/analyze/market", s.handleMarketSentiment).Methods("GET")
	
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

// handleAIFeatures returns multi-timeframe indicators for AI consumption
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

	features := make(map[string]indicators.FeatureVector)

	for _, tf := range timeframes {
		tf = strings.TrimSpace(tf)
		candles, err := s.engine.GetDBClient().FetchCandlesTF(r.Context(), symbol, tf, 200)
		if err != nil {
			log.Printf("Error fetching %s candles for %s: %v", tf, symbol, err)
			features[tf] = indicators.FeatureVector{
				Interval: tf,
				Trend:    indicators.TrendInfo{Direction: "ERROR", Strength: 0},
			}
			continue
		}
		features[tf] = indicators.GenerateFeatureVector(tf, candles)
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
