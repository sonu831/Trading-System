# Stock Analysis By Gurus - AI Agent Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot and other AI agents. -->

## Project Overview

**Stock Analysis By Gurus** is a premium, high-performance financial analytics platform. The system processes real-time Nifty 50 market data to provide institutional-grade insights to retail traders.

### Core Products

1.  **Stock Analysis Portal** (`layer-8-presentation-notification/stock-analysis-portal`): The client-facing "Window to the Market".
2.  **Control Tower** (Grafana): The internal "God's Eye View" of system health.

## Architecture Layers

The system is organized into **9 distinct layers**. When generating code or navigating the codebase, always respect these boundaries:

| Layer | Name | Technology | Description |
|-------|------|-----------|-------------|
| **Layer 1** | Ingestion | Node.js 20 | Connects to vendors (MStock, Kite), normalizes ticks, pushes to Kafka. Includes Swarm Mode for parallel historical backfill. |
| **Layer 2** | Processing | Node.js 20 | Consumes raw ticks from Kafka, aggregates into 1-minute OHLCV candles, persists to TimescaleDB, caches in Redis. |
| **Layer 3** | Storage | Infrastructure | TimescaleDB (historical), Redis (hot cache), Kafka (message bus). |
| **Layer 4** | Analysis | Go 1.23 | Computes technical indicators (RSI, MACD, Bollinger, EMA) with <100ms latency. |
| **Layer 5** | Aggregation | Go 1.23 | Calculates market-wide breadth, sector performance, and sentiment. |
| **Layer 6** | Signal | Node.js 20 | Evaluates trading strategies to generate Buy/Sell/Hold signals. |
| **Layer 7** | Core Interface | Node.js 20 (Fastify) | REST API + WebSocket server. Single source of truth for data access. Uses Prisma ORM and Awilix DI. |
| **Layer 8** | Presentation & Notification | Next.js / Node.js | Stock Analysis Portal (React), Telegram Bot, Email Service. |
| **Layer 9** | AI Service | Python 3.11 (FastAPI) | ML inference — supports Heuristic, PyTorch, OpenAI, Claude, Ollama engines. |

## Critical Directives

- **NEVER** hardcode secrets (API keys, passwords, TOTP codes). Use `process.env` or `os.Getenv` loading from `.env`. **Never log TOTP codes or tokens to stdout.**
- **NEVER** commit large files or `node_modules` to git.
- **ALWAYS** use the modular Docker Compose files in `infrastructure/compose/`.
- **ALWAYS** run `make ui` or `make app` to verify builds after major changes.
- **ALWAYS** use `ON CONFLICT DO NOTHING` (or `ON CONFLICT ... DO UPDATE`) for any `INSERT` into TimescaleDB hypertables to prevent duplicate data errors.

## Key Patterns & Standards

### Historical Backfill: The "Midnight Bug" Fix

When constructing date ranges for broker APIs (especially MStock), the **end date MUST include the market close time** `15:30:00`. A bare date like `2025-01-02` resolves to midnight (`00:00:00`), which falls *before* market open and causes the API to return zero rows.

```javascript
// CORRECT: Always append market close time to toDate
const toDate = '2025-01-02 15:30:00';
// WRONG: Resolves to midnight, returns 0 candles
const toDate = '2025-01-02';
```

Similarly, `fromDate` should use `09:15:00` (market open) to avoid ambiguity.

### Swarm Mode (Parallel Historical Fetch)

Large date ranges (>35 days) are split into monthly partitions by `TimeSlicer` and fetched in parallel using `p-limit` concurrency control. This is called **Swarm Mode**. Key rules:

- `TimeSlicer` (`layer-1-ingestion/src/utils/time-slicer.js`) splits by `MONTHLY` or `WEEKLY` strategy.
- `HistoricalChunker` (`layer-1-ingestion/src/utils/historical-chunker.js`) further splits each partition into API-safe chunks (max 1000 candles).
- Swarm state is published to Redis (`system:layer1:swarm_status`) for dashboard visibility.
- Results are sorted chronologically after merge. Sort must handle both array `[time, O, H, L, C, V]` and object `{ datetime, ... }` formats.
- Failed partitions are retried up to 3 times with exponential backoff.

### Shared Health-Check Library

All services **must** use the shared health-check module at `shared/health-check/` to wait for infrastructure before starting:

```javascript
const { waitForAll, initHealthMetrics } = require('/app/shared/health-check');

await waitForAll({
  kafka: { brokers: kafkaBrokers, topic: kafkaTopic },
  redis: { url: redisUrl },
  timescale: { connectionString: timescaleUrl, requiredTables: ['candles_1m'] },
}, { logger });
```

### Graceful Shutdown

All Node.js services **must** handle `SIGTERM` and `SIGINT` to cleanly close:
- Kafka producers/consumers
- Redis clients
- Database pools
- WebSocket connections

```javascript
async function shutdown() {
  logger.info('Shutting down gracefully...');
  try {
    if (kafkaProducer) await kafkaProducer.disconnect();
    if (redisClient) await redisClient.quit();
    if (pool) await pool.end();
  } catch (err) {
    logger.error(`Shutdown error: ${err.message}`);
  }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Database: TimescaleDB Backup & Restore

**CRITICAL: Plain SQL `pg_dump` silently loses compressed TimescaleDB data.** This is a silent data loss bug with no warning or error. Always follow these rules:

1. **ALWAYS use `pg_dump -Fc` (custom format)** for backups. Never use plain SQL format for TimescaleDB databases with compression enabled.
   ```bash
   # CORRECT: Custom format - handles compressed chunks, catalog, aggregates
   pg_dump -U trading -Fc nifty50 > backup.dump

   # WRONG: Plain SQL - silently drops all compressed chunk data (exits 0, no warning)
   pg_dump -U trading nifty50 --data-only > backup.sql
   ```

2. **NEVER split schema and data backups** for TimescaleDB. The catalog metadata, chunk table IDs, and row data are tightly coupled. A schema backup + separate data backup will have mismatched chunk IDs and fail silently on restore.

3. **ALWAYS use `pg_restore`** for restoring `.dump` files. For nuclear restore: `DROP DB` → `CREATE DB` → `pg_restore`.
   ```bash
   pg_restore -U trading -d nifty50 --no-owner --no-privileges < backup.dump
   ```

4. **NEVER use `sed` to rewrite chunk table names** in COPY statements. Different hypertables have different column counts. Blindly redirecting `_hyper_10_*` (9 cols) into `candles_1m` (11 cols) causes `syntax error at or near "375"` type errors.

5. **If you must use plain SQL format**, decompress ALL chunks first:
   ```sql
   SELECT decompress_chunk(c) FROM show_chunks('candles_1m') c;
   ```

6. **Test restores regularly**: `make backup && make db-reset && make restore && make check-restore`

7. Use `make backup` (which runs `pg_dump -Fc`) for all backups. Use `make restore` for restores. See [investigation_backup.md](../investigation_backup.md) for the full forensic analysis.

### Database: Unique Constraints

The `candles_1m` hypertable uses a **unique constraint on `(time, symbol)`**. All inserts must use:

```sql
INSERT INTO candles_1m (time, symbol, exchange, open, high, low, close, volume)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT DO NOTHING
```

This prevents the "50% Data Loss" bug where duplicate rows caused insert failures that silently dropped entire batches.

## Frontend Rules (Stock Analysis Portal)

- **Aesthetics**:
  - Use **Tailwind CSS** exclusively. No custom CSS files unless absolutely necessary.
  - Design for **"Premium/Institutional"** feel: Dark mode by default, glassmorphism, subtle gradients, and smooth transitions.
  - Avoid "Default HTML" looks. Every component must be styled.
  - **Color Palette**: Use `slate-900` for backgrounds, `indigo-500` for primary actions, `emerald-400` for bullish, `rose-400` for bearish.
- **Performance**:
  - Use `React.memo` for high-frequency update components (like Ticker grids).
  - Format timestamps on the client side using `utils/format.js`.
- **Structure**:
  - Components go in `src/components/`.
  - Pages go in `src/pages/`.

## Backend Rules (Go & Node.js)

- **Error Handling**:
  - **Go**: Wrap errors with `fmt.Errorf("context: %w", err)`. Do not just return `err`.
  - **Node**: Use `try/catch` in async functions. Never leave promises unhandled. Never swallow errors silently — always log with context.
- **Logging**:
  - Use **Pino** for all Node.js services (structured JSON logging).
  - Use **Zerolog** for Go services.
  - **Never use `console.log`/`console.error`** in service code — always use the `logger` module.
  - Logs must be machine-readable for the Loki stack.
- **Concurrency**:
  - **Go**: Use `sync.WaitGroup` to coordinate goroutines. Avoid `time.Sleep` in production code.
  - **Node**: Use `p-limit` for controlled concurrency (Swarm Mode). Use `Promise.all` for independent I/O.
- **Date/Time**:
  - Use **Luxon** (`DateTime`) for all date operations in Node.js. Do not use `moment` or raw `Date`.
  - Always set timezone to `Asia/Kolkata` for market-hours logic.

## Security Rules

- Validate all incoming API requests (Fastify JSON Schema or Zod/Joi).
- Sanitize inputs to prevent SQL injection (use parameterized queries).
- Sanitize user-generated content before embedding in HTML (email templates, etc.) to prevent XSS.
- Public-facing services must sit behind the Nginx Gateway (`infrastructure/gateway`).

## Naming Conventions & Casing

Strictly adhere to these casing standards to ensure consistency across the polyglot repo.

### Directories & Files

| Type                       | Convention                  | Example                                                  |
| -------------------------- | --------------------------- | -------------------------------------------------------- |
| **Root Layer Directories** | `kebab-case` (numbered)     | `layer-1-ingestion`, `layer-8-presentation-notification` |
| **Component Directories**  | `kebab-case`                | `stock-analysis-portal`, `dashboard-components`          |
| **Infrastructure Files**   | `docker-compose.[name].yml` | `docker-compose.infra.yml`, `docker-compose.gateway.yml` |
| **Config Files**           | `kebab-case` or standard    | `prometheus.yml`, `nginx.conf`, `tailwind.config.js`     |
| **React Components**       | `PascalCase.jsx`            | `MarketOverview.jsx`, `SignalsFeed.jsx`                  |
| **Node.js Modules**        | `camelCase.js`              | `marketData.js`, `websocketClient.js`                    |
| **Go Source Files**        | `snake_case.go`             | `market_data.go`, `candle_aggregator.go`                 |
| **Go Test Files**          | `snake_case_test.go`        | `market_data_test.go`                                    |
| **Scripts**                | `snake_case`                | `backfill_history.sh`, `feed_kafka.js`                   |

### Code Artifacts

#### Go (Golang)

- **Packages**: `lowercase` (single word preferable).
  - `package ingestion`, `package indicators`
- **Exported Structs/Funcs**: `PascalCase`.
  - `func CalculateRSI(...)`, `type MarketTick struct {}`
- **Private Structs/Funcs**: `camelCase`.
  - `func processTick(...)`, `type internalBuffer struct {}`
- **Interfaces**: `PascalCase` (often ending in `er`).
  - `type TickProcessor interface {}`

#### Node.js / JavaScript

- **Variables/Instances**: `camelCase`.
  - `const webSocketClient = ...`
- **Classes**: `PascalCase`.
  - `class MovingAverageStrategy {}`
- **Constants**: `UPPER_SNAKE_CASE`.
  - `const MAX_RETRY_ATTEMPTS = 5;`
- **File-scoped Functions**: `camelCase`.
  - `function parseMessage(msg) { ... }`
- **Logger exports**: Always export as `{ logger }` (named export) for consistency.

#### Database (SQL)

- **Tables**: `snake_case` (pluralized).
  - `market_ticks`, `user_orders`
- **Columns**: `snake_case`.
  - `created_at`, `symbol_name`, `last_price`

## Dependencies & Config

- **Networking**: All containers share `local-trading-network`.
- **Docker Network**: `local-trading-network` (defined in `docker-compose.infra.yml`).
- **Ports**:
  - Dashboard: `3000`
  - API: `4000`
  - Ingestion: `9101`
  - Processing: `3002`
  - Signal: `8082`
  - Gateway: `8088`
  - Grafana: `3001`
  - Kafka: `9092` (internal: `29092`)
  - Redis: `6379`
  - TimescaleDB: `5432`
  - Prometheus: `9090`

## Testing Guidelines

- **Unit**: Test core logic (Indicators, Strategies) in isolation.
- **Integration**: Use `docker-compose.infra.yml` to spin up dependencies for tests.
- **Mocking**: Mock external vendor APIs (MStock, Kite) to avoid rate limits.

## Performance & Optimization

### General Principles
1.  **Performance First**: This is a production-grade trading system. Latency matters.
    -   Avoid blocking the Event Loop in Node.js.
    -   Offload heavy computations to Worker Threads or Go microservices (Layer 4).
    -   Always use `Promise.all` for parallel async operations.
    -   **Externalize Configuration**:
        -   ALL magic numbers (timeouts, intervals, limits) must be in `.env`.
        -   Frontend: Use `NEXT_PUBLIC_` prefix.
        -   Backend: Use `process.env` with sensible defaults.

### Caching Strategy
-   **Layer 2 (Processing)**: Cache aggregated candles in Redis (latest only).
-   **Layer 7 (API)**:
    -   Cache all expensive DB queries (Counts, Aggregations).
    -   Use `SystemRepository.getCached()` wrapper for consistent behavior.
    -   Default TTL: 30-300s depending on criticality.

### Frontend Optimization
-   **Polling**:
    -   Avoid aggressive polling (< 5s) unless absolutely necessary for real-time ticks.
    -   Use `30s` for status checks (dashboard, system health).
    -   Implement "stale-while-revalidate" strategies.


---
