# Changelog

All notable changes to the **Nifty 50 Trading System** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-19

### 🚀 Added

- **Notification Layer Refactor**:
  - Created **`email-service`**: A new Node.js consumer that listens to Redis events and sends automated emails via SMTP.
  - Isolated notifications into **`infrastructure/compose/docker-compose.notify.yml`** for independent management.
  - Added **`make notify`** to the `Makefile` for streamlined startup of the notification stack.
- **Bot Features (Guru Ji 2.0)**:
  - **Suggestions Box**: Implemented `/suggest <text>` command to capture user feedback directly into the **PostgreSQL** `user_suggestions` table.
  - **Email Subscriptions**: Added `/subscribe <email>` command to collect user emails for newsletters and automated stock updates.
  - **Service Probing**: Enhanced `/status` command to perform active health checks (pinging API, Analysis, Aggregation, and Signal layers).
  - **Automated Alerts**:
    - **Morning Greeting**: Automated cron job for 9:00 AM IST greetings.
    - **Backfill Notifications**: Real-time Telegram alerts upon completion of historical data backfills.
    - **Deployment Alerts**: Immediate "Namaste Ji" broadcast when the bot service restarts.
- **Layer 7 Renaming**:
  - Renamed `layer-7-presentation` to **`layer-7-presentation-notification`** to accurately reflect its expanded scope (Dashboard, API, Bot, Email).

### 🏗️ Refactor

- **Structured Logging**:
  - Implemented **Pino** logging in **Layer 6 (Signal)** and **Layer 7 (Email/Bot/API)** for unified JSON-formatted observability.
- **Database Schema**:
  - Added `user_suggestions` and `user_subscribers` tables to the TimescaleDB/PostgreSQL instance.

### 🛠 Changed

- **Configuration**:
  - Integrated real **Gmail SMTP** support with `.env` variables for secure email delivery.
  - Updated documentation (`README.md`, `CONTRIBUTING.md`, etc.) to match new layer names and features.

### 🐛 Fixed

- **Grafana Proxying**:
  - Resolved `rewrite` issues in `next.config.js` to enable seamless Grafana access via the Unified Gateway.
- **Dependency Issues**:
  - Fixed `fsevents` build failure in Linux/Docker environments for the Email service.

## [0.2.4] - 2026-01-18

### 🚀 Added

- **Development Standards (Rulebook)**:
  - Created `.github/copilot-instructions.md`: A comprehensive guide for AI agents and developers, defining:
    - **Architecture Layers**: Clear boundaries for all 7 layers.
    - **Naming Conventions**: Strict `camelCase` (JS), `snake_case` (Go/Scripts), and `kebab-case` (Infrastructure).
    - **Rule Sets**: Mandatory structured logging, error wrapping, and security practices.
- **Product Branding**:
  - Renamed "Dashboard" to **Stock Analysis Portal** (`layer-7-presentation-notification/stock-analysis-portal`) to align with the "Stock Analysis By Gurus" product identity.

### 🏗️ Refactor

- **Layer 2 (Processing)**:
  - **Structured Logging**: Replaced generic `console.log` with **Pino** (`src/utils/logger.js`) for machine-readable JSON logs.
  - **Naming Compliance**: Renamed services to `camelCase` (`redis-cache.js` -> `redisCache.js`) to match the new Rulebook.
- **Layer 6 (Signal)**:
  - Renamed `decision-engine.js` to `decisionEngine.js` for consistency.

### 🐛 Fixed

- **Frontend Timestamps**:
  - Fixed "Invalid Date" errors by implementing a robust timestamp parser (`formatTime`) that handles nanosecond-precision ISO strings from the backend.
- **Development Guidelines**:
  - Standardized directory structures and updated `Makefile` references to the new `stock-analysis-portal` path.

## [0.2.3] - 2026-01-18

### 🚀 Added

- **Modular Infrastructure**:
  - Split monolithic `docker-compose.yml` into domain-specific modules in `infrastructure/compose/`:
    - `infra.yml`: Data stores (Kafka, Redis, TimescaleDB).
    - `app.yml`: Application pipeline (Layers 1-6 + API).
    - `ui.yml`: Dashboard only.
    - `observe.yml`: Observability stack (Prometheus, Grafana).
    - `gateway.yml`: Nginx Gateway + Cloudflare Tunnel.
  - Added `make gateway`, `make share`, and `make share-url` for easy public exposure.
- **Unified Gateway**:
  - Implemented Nginx gateway on port `8088` to route traffic to Dashboard, API, and Grafana (via subpath).
  - Added dynamic DNS resolution to Nginx (`127.0.0.11`) to handle startup dependency race conditions.

### 🛠 Changed

- **Developer Experience**:
  - Streamlined `Makefile` with concise targets (`make up`, `make down`) and improved help text.
  - Consolidated environment variables: `env_file` directives removed in favor of passing `--env-file .env` via Makefile to ensure consistent variable loading from project root.
  - Updated Root `README.md` with comprehensive architecture diagram, quick start guide, and documentation index.

### 🐛 Fixed

- **Network Partitioning**:
  - Resolved `502 Bad Gateway` and internal communication failures by standardizing all compose modules to use a single external network (`compose_trading-network`).
- **Environment Loading**: Fixed issue where modular compose files couldn't locate `.env` file by enforcing explicit path loading.

## [0.2.2] - 2026-01-18

### 🚀 Added

- **Historical Backfill Control**:
  - Implemented **Manual Backfill Trigger** via Dashboard button and REST API (`POST /api/v1/system/backfill/trigger`).
  - Added **Granular Progress Tracking**: Dashboard now shows symbol-level details (e.g., "Fetching M&M (25/50)") instead of just a flat percentage.
  - Implemented **Concurrency Safety**: Prevents multiple simultaneous backfill executions via global `isBackfilling` state and Redis locks.
- **Advanced Network Observability**:
  - **WebSocket Telemetry**: Added raw packet count (`websocket_packets_total`) and data size (`websocket_data_bytes_total`) tracking for all market data vendors.
  - **IPC Metric Bridge**: Built an IPC channel between the main Ingestion service and its child backfill processes, allowing real-time metric updates (HTTP calls, latency) to be captured from background jobs.
  - **Global Dashboard Enhancements**:
    - Added localized progress bars to the **Layer 1 (Ingestion)** card.
    - Added visual feedback (pulse effects) to **TimescaleDB** and **Kafka** cards to indicate active historical data feeding.
- **Unified Gateway & Public Exposure**:
  - Created **Nginx Gateway** (`infrastructure/gateway/nginx.conf`) to serve all services (Dashboard, Grafana, API, Kafka UI) under a single port/domain.
  - Added `docker-compose.expose.yml` for simplified external access with support for **Cloudflare Tunnels**.
  - Enabled **Relative API Routing** in the Dashboard to allow seamless operation across different public URLs.
  - Provided a comprehensive **Public Exposure Guide** (`EXPOSURE_GUIDE.md`).
- **Grafana "Control Tower" v2**:
  - Reorganized dashboard rows to prioritize **Data Ingestion Network Health**.
  - Added **Vendor-Neutral** panels for API Traffic and Latency (pre-configured for multi-vendor support).
  - Improved "No Data" handling: Idle market states now show `0` instead of "No Data".

### 🏗️ Implementation Stages (Backfill Flow)

The historical backfill process has been re-engineered for observability across three stages:

1.  **Stage 1: Initialization**
    - Ingestion service detects market closure or receives a Redis `START_BACKFILL` command.
    - Sets global `isBackfilling` flag and updates Redis status to `running`.
2.  **Stage 2: Background Data Ingestion (IPC Bridge)**
    - Launches child process using `fork` with an active IPC channel.
    - Script downloads historical OHLC data from Vendor HTTP APIs.
    - **Observability**: Real-time progress (symbol-by-symbol) and network metrics are sent via `process.send()` to the parent service.
3.  **Stage 3: Kafka Pipeline & Storage Integration**
    - Downloaded data is fed into Kafka, triggering the standard processing pipeline.
    - **Visual Mapping**: Dashboard triggers pulse animations on Storage and Kafka cards to visualize the data flow from internal storage into the real-time pipeline.

### 🛠 Changed

- **Infrastructure**:
  - Refactored backfill logic into a reusable `runBackfill` module with explicit IPC support.
  - Updated Grafana dashboard layout to resolve grid coordinate overlaps.

### 🐛 Fixed

- **Prometheus Scrapping**: Fixed missing metrics from backfill scripts by switching from `exec` to `fork` with IPC.
- **UI State**: Resolved "No Data" gaps in Grafana panels during market-closed hours.

## [0.2.1] - 2026-01-18

### 🚀 Added

- **MStock Integration**:
  - Implemented correct 2-Step Authentication flow (`Login` -> `VerifyTOTP`) using official `@mstock-mirae-asset/nodetradingapi-typeb` SDK.
  - Added support for generating TOTP using `otpauth` and base32 secrets.
  - Added robust error handling for "Login Only" tokens vs "Trading Tokens".

### 🐛 Fixed

- **MStock WebSocket**:
  - Resolved `502 Bad Gateway` diagnosis process (identified as Infrastructure/Account issue).
  - Fixed SDK initialization for v0.0.2 (removed invalid positional arguments).
  - Fixed `MTicker` event handling (switched to property-based callbacks `onConnect`, `onBroadcastReceived`).
  - Added JWT token unwrapping to handle large access tokens.

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
- **Linting Performance**: Fixed excessively slow linting by globally ignoring `node_modules` and `vendor` directories in `eslint.config.js`.

### 🏗️ Refactor

- **Layer 1 Ingestion**:
  - Implemented **Vendor Adapter Pattern** to support multiple market data providers.
  - Created `VendorFactory` to dynamically load `Kite` or `IndianApi` adapters.
  - Added `IndianApiVendor` which integrates with external OpenAPI specs (`vendor/IndianApi/indian-api.json`) and secrets.
  - Cleaned up root `index.js` by removing legacy `WebSocketManager`.
- **Shutdown**: Improved `make down` to include `--profile app`, preventing "network has active endpoints" errors.
