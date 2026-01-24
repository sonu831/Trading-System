package api

import (
	"encoding/json"
	"log"
	"net/http"
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

func (s *Server) Start(addr string) error {
	srv := &http.Server{
		Handler:      s.router,
		Addr:         addr,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}
	return srv.ListenAndServe()
}
