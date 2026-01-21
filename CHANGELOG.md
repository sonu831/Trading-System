# Changelog

All notable changes to the **Nifty 50 Trading System** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] - 2026-01-21

### 📚 Documentation

- **Comprehensive Architecture Documentation**:
  - Created `docs/ARCHITECTURE_DEEP_DIVE.md` with detailed documentation for all 7 layers.
  - Added interactive **Draw.io architecture diagram** with complete system overview, data flows, and internal components.
  - Documented multi-vendor "Octopus Pattern" for Layer 1 (MStock, Flattrade, Zerodha, Batch APIs).
  - Documented TimescaleDB schema with hypertables, continuous aggregates (5m, 15m views), and compression policies.
  - Added data volume calculations (22.5M rows for 5 years, ~2-3GB with compression).
  - Included future AI/ML integration points for Layer 4 (pattern detection) and Layer 6 (decision engine).
  - Added AWS hybrid architecture documentation with VPC, RDS, and ElastiCache setup.

## [0.6.0] - 2026-01-21

### 🚀 Added

- **Comprehensive Telegram Bot Monitoring**:
  - Instrumented bot with **Prometheus** metrics (commands, latency, users, errors).
  - Created **"Telegram Bot - Guru Ji"** Grafana dashboard with real-time stats.
  - Added **"Top Command"** card and **"Command Usage Statistics"** bar chart to track popularity.
  - Integrated **Loki Logs** panel directly into the dashboard for real-time diagnostic visibility.
- **Improved Root Observability**:
  - Updated `system-overview.json` dashboard with accurate real-time bot activity tracking via specific Prometheus queries.

### 🐛 Fixed

- **Mac M1/ARM64 Compatibility**: Resolved Loki logging driver failures in the `ingestion` service by switching to Promtail-based log collection.
- **Metric Collection Reliability**: Fixed a critical bug in the `trackCommand` wrapper that was preventing command metrics from being incremented correctly.
- **Infrastructure Stability**: Added orchestration health checks and dependency wait-times for Kafka/Zookeeper in `docker-compose.infra.yml`.

## [0.5.1] - 2026-01-20

### 🐛 Fixed

- **Dashboard Build Failure**:
  - Updated `Dockerfile` in `stock-analysis-portal` to explicitly copy `package-lock.json`. This fixes the `MODULE_NOT_FOUND` error caused by non-deterministic `npm install`.
- **CI/CD Credentials**:
  - Resolved "Credentials could not be loaded" error in GitHub Actions (`.github/workflows/deploy.yml`).
  - Removed conflicting OIDC `permissions` block and strictly enforced secret-based authentication (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

## [0.5.0] - 2026-01-20

### 🚀 Added

- **Extreme Cost Optimization**:
  - Pivoted from EKS ($75+/mo) to a single **AWS EC2 Spot Instance (t3.micro)** (~$3/mo).
  - Created **`docker-compose.prod.yml`** with strict memory limits (Kafka 256MB, Redis 64MB) to fit within 1GB RAM.
- **Automated Deployment**:
  - **`scripts/deploy_spot.sh`**: Idempotent script that handles server provisioning (20GB disk), swap creation, and "Zero-Touch" deployment.
  - **Mac Compatibility**: Switched from `tar` to `zip` for deployment artifacts to eliminate `._` metadata file errors during Linux builds.
- **CI/CD Pipeline**:
  - Added **Github Actions Workflow** (`.github/workflows/deploy.yml`) to auto-deploy changes on push to `main`.
- **Documentation**:
  - Added **`DEPLOYMENT.md`** guide for Manual and CI/CD deployment setup.

### 🗑️ Infrastructure Cleanup

- **Removed Legacy Infrastructure**:
  - Archived complex Terraform (EKS/VPC) and Kubernetes manifests to **`_archive/`**.
  - Deleted unused `infrastructure/` directory to simplify project root.
- **Simplified Workflow**:
  - Restored **Local Granularity**: `Makefile` and `docker-compose.yml` now support module-based local development (`make infra`, `make app`) while `deploy_spot.sh` uses the unified production config.

## [0.4.0] - 2026-01-20

### 🚀 Added

- **Telegram Bot "Guru Ji 3.0"**:
  - **Interactive Menu**: Added `Markup.keyboard` for `/start`, `/help`, and `hi` greetings. Users now see a clickable button grid instead of plain text.
  - **`/backfill` Command**: Now parses arguments (e.g., `/backfill 30d 1m`) to specify days and candle interval. Returns detailed Job ID, range, and symbols.
  - **`/livestatus` Command**: Opens a real-time "Live Console" that streams backfill progress by editing a single message every 3 seconds. Auto-closes on job completion.
  - **Post-Backfill Inline Buttons**: When a backfill completes, the notification includes inline buttons for `/ownanalysis`, `/movers`, `/high`, `/low`, `/feed`.
  - **Enhanced `/stop`**: Now intelligently stops active `/livestatus` streams or unsubscribes from alerts.
  - **Callback Query Handlers**: Added `bot.action` handlers for all inline button types.

- **Real-time Log Stream (UI)**:
  - **Backend**: `batch_nifty50.js` now pushes detailed log messages to `system:layer1:logs` Redis List.
  - **API**: `/api/v1/system-status` exposes these logs.
  - **Frontend**: `BackfillProgress.jsx` displays a scrolling terminal-like window with real-time logs.

- **Standardized Backfill Status Codes**:
  - Backend scripts (`batch_nifty50.js`, `feed_kafka.js`, `index.js`) now emit integer status codes (`0:Idle`, `1:Run`, `2:Done`, `3:Fail`) for Grafana compatibility.
  - Frontend components (`BackfillProgress.jsx`, `BackfillPanel.jsx`) updated to interpret both string and numeric statuses.

### 🐛 Fixed

- **Kafka Connection Refused**: Fixed `feed_kafka.js` defaulting to `localhost:9092`. Now correctly reads `KAFKA_BROKERS` env var (resolves to `kafka:29092` in Docker).
- **WRONGTYPE Redis Error**: Cleared and auto-fixed stale `system:layerX:metrics` keys that caused type conflicts between Hash and String operations.
- **Ingestion Container Stale Code**: Forced explicit Docker rebuild to ensure code changes are baked into images.

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
