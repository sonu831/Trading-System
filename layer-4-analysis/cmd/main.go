// Layer 4: Analysis Engine
// Parallel technical analysis of all 50 Nifty stocks using goroutines
//
// Author: Utkarsh Pandey

package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/analyzer"
)

func main() {
	log.Println("🚀 Starting Layer 4: Analysis Engine")

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize the analysis engine
	engine, err := analyzer.NewEngine(ctx)
	if err != nil {
		log.Fatalf("❌ Failed to initialize engine: %v", err)
	}

	// Start the engine
	if err := engine.Start(); err != nil {
		log.Fatalf("❌ Failed to start engine: %v", err)
	}

	// Start Prometheus Metrics Server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Println("📊 Metrics server listening on :8081")
		if err := http.ListenAndServe(":8081", nil); err != nil {
			log.Printf("⚠️ Metrics server failed: %v", err)
		}
	}()

	log.Println("✅ Analysis Engine started successfully")
	log.Println("📊 Monitoring 50 Nifty stocks with parallel goroutines")

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	log.Println("🛑 Shutdown signal received")

	// Graceful shutdown
	engine.Stop()
	log.Println("👋 Analysis Engine stopped")
}
