// Layer 4: Analysis Engine
// Parallel technical analysis of all 50 Nifty stocks using goroutines
//
// Author: Yogendra Singh

package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/analyzer"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/api"
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

	// Start API Server (includes metrics)
	server := api.NewServer(engine)
	go func() {
		log.Println("📊 API Server listening on :8081")
		if err := server.Start(":8081"); err != nil {
			log.Printf("⚠️ API Server failed: %v", err)
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
					"service":    "analysis",
					"timestamp":  time.Now(),
				}
				engine.PublishRuntimeMetrics(metrics)
			}
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
