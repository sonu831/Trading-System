package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	log.Println("🚀 Layer 5 Aggregation Service Starting...")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Prometheus Metrics Endpoint
	http.Handle("/metrics", promhttp.Handler())

	// Health Check
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "Layer 5 Aggregation Alive")
	})

	// Placeholder for Aggregation Logic
	go func() {
		for {
			log.Println("📊 Calculating Market Breadth (Mock)...")
			time.Sleep(10 * time.Second)
		}
	}()

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
