# Changelog

All notable changes to the **Nifty 50 Trading System** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-17

### 🚀 Added

- **Full Stack Observability**: Implemented comprehensive Prometheus monitoring across all 7 layers of the architecture.
  - **Layer 1 (Ingestion)**: Added `prom-client` to track incoming market data RPS and latency.
  - **Layer 2 (Processing)**: Instrumentation for data processing throughput.
  - **Layer 4 (Analysis)**: Added `prometheus/client_golang` and a dedicated HTTP metrics server on port `:8081` to expose Go runtime statistics (Goroutines, GC, Heap).
  - **Layer 5 (Aggregation)**: Instrumentation for aggregation engine performance.
  - **Layer 6 (Signal)**: Metrics for signal generation events.
  - **Layer 7 (Presentation)**:
    - **API**: Request rate and latency tracking.
    - **Telegram Bot**: Activity metrics.
- **"Control Tower" Dashboard**: A unified Grafana dashboard (`system-overview.json`) providing a "God's Eye View" of the entire system.
  - Dedicated rows for each layer.
  - Visualizations for Infrastructure (Redis/TimescaleDB), Application Metrics (RPS/Latency), and Runtime Stats (Go/Node.js).
- **Makefile Commands**:
  - `make clean`: Completely stops all services (including app profile) and removes Docker volumes to ensure a fresh state.

### 🛠 Changed

- **Infrastructure**:
  - Upgraded **Layer 4** and **Layer 5** Dockerfiles to use `golang:1.23-alpine` to match local development dependencies.
  - Updated `docker-compose.yml` to support the new metrics architecture.
- **Monitoring Configuration**:
  - Updated `prometheus.yml` to scrape 7 distinct targets (one for each layer) instead of just one.
  - Standardized Grafana datasource UID to `prometheus-datasource` to prevent provisioning errors.
- **Dependency Management**:
  - Replaced incorrect `zerodha-kite-connect` dependency with the official `kiteconnect` package in Layer 1.

### 🐛 Fixed

- **Build Failures**: Resolved `go.mod` version mismatch where local toolchain (Go 1.25) enforced Go 1.23+ requirements that older Docker images couldn't support.
- **Telegram Bot**: Fixed syntax error (mismatched braces) in `index.js`.
- **Grafana Connection**: Fixed "connection refused" and "datasource not found" errors by networking cleanup and explicit service naming.
- **Shutdown**: Improved `make down` to include `--profile app`, preventing "network has active endpoints" errors.
