// Layer 5: Aggregation Service
// Aggregates individual stock analysis into market-wide views
//
// Author: Yogendra Singh

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-5-aggregation/internal/aggregator"
)

func main() {
	log.Println("🚀 Starting Layer 5: Aggregation Service")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize aggregation engine
	engine, err := aggregator.NewEngine(ctx)
	if err != nil {
		log.Fatalf("❌ Failed to initialize engine: %v", err)
	}

	// Start aggregation
	if err := engine.Start(); err != nil {
		log.Fatalf("❌ Failed to start engine: %v", err)
	}

	// HTTP Server for health and metrics
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","service":"layer-5-aggregation"}`)
	})

	go func() {
		log.Printf("📊 HTTP server listening on :%s", port)
		if err := http.ListenAndServe(":"+port, nil); err != nil {
			log.Printf("⚠️ HTTP server error: %v", err)
		}
	}()

	// Start Metrics Publisher
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				metrics := map[string]interface{}{
					"goroutines": runtime.NumGoroutine(),
					"service":    "aggregation",
					"timestamp":  time.Now(),
				}
				engine.PublishRuntimeMetrics(metrics)
			}
		}
	}()

	log.Println("✅ Aggregation Service started successfully")

	// Wait for shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("🛑 Shutdown signal received")
	engine.Stop()
	log.Println("👋 Aggregation Service stopped")
}
