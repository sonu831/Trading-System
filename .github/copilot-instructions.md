# Stock Analysis By Gurus - AI Agent Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot and other AI agents. -->

## Project Overview

**Stock Analysis By Gurus** is a premium, high-performance financial analytics platform. The system processes real-time Nifty 50 market data to provide institutional-grade insights to retail traders.

### Core Products

1.  **Stock Analysis Portal** (`layer-7-presentation/stock-analysis-portal`): The client-facing "Window to the Market".
2.  **Control Tower** (Grafana): The internal "God's Eye View" of system health.

## 🏗 Architecture Layers

The system is organized into 7 distinct layers. When generating code or navigating the codebase, always respect these boundaries:

- **Layer 1: Ingestion** (Node.js) - Connects to vendors (MStock, Kite), normalizes ticks, pushes to Kafka.
- **Layer 2: Processing** (Go) - Aggregates raw ticks into OHLCV candles (1min, 5min).
- **Layer 3: Storage** (Infra) - Redis (Hot data), TimescaleDB (Historical), Kafka (Bus).
- **Layer 4: Analysis** (Go) - Computes technical indicators (RSI, MACD) on stream.
- **Layer 5: Aggregation** (Go) - Calculates market-wide breadth and sector performance.
- **Layer 6: Signal** (Node.js) - Evaluates strategies to generate Buy/Sell signals.
- **Layer 7: Presentation** (Next.js) - Visualizes data via the Stock Analysis Portal.

## 📜 Rule Sets

### 🚨 Critical Directives

- **NEVER** hardcode secrets (API keys, passwords). Use `process.env` or `os.Getenv` loading from `.env`.
- **NEVER** commit large files or `node_modules` to git.
- **ALWAYS** use the modular Docker Compose files in `infrastructure/compose/`.
- **ALWAYS** run `make ui` or `make app` to verify builds after major changes.

### 🎨 Frontend Rules (Stock Analysis Portal)

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

### ⚡ Backend Rules (Go & Node.js)

- **Error Handling**:
  - **Go**: Wrap errors with `fmt.Errorf("context: %w", err)`. Do not just return `err`.
  - **Node**: Use `try/catch` in async functions. Never leave promises unhandled.
- **Logging**:
  - Use **JSON structured logging** (Zerolog for Go, Pino/Winston for Node).
  - Logs must be machine-readable for the ELK/Loki stack.
- **Concurrency**:
  - **Go**: Use `sync.WaitGroup` to coordinate goroutines. Avoid `time.Sleep` in production code.
  - **Node**: Use `Promise.all` for parallel I/O.

### 🔒 Security Rules

- Validate all incoming API requests (Zod/Joi schemas).
- Sanitize inputs to prevent SQL injection (use parameterized queries).
- Public-facing services must sit behind the Nginx Gateway (`infrastructure/gateway`).

## � Naming Conventions & Casing

Strictly adhere to these casing standards to ensure consistency across the polyglot repo.

### 📂 Directories & Files

| Type                       | Convention                  | Example                                                  |
| -------------------------- | --------------------------- | -------------------------------------------------------- |
| **Root Layer Directories** | `kebab-case` (numbered)     | `layer-1-ingestion`, `layer-7-presentation`              |
| **Component Directories**  | `kebab-case`                | `stock-analysis-portal`, `dashboard-components`          |
| **Infrastructure Files**   | `docker-compose.[name].yml` | `docker-compose.infra.yml`, `docker-compose.gateway.yml` |
| **Config Files**           | `kebab-case` or standard    | `prometheus.yml`, `nginx.conf`, `tailwind.config.js`     |
| **React Components**       | `PascalCase.js`             | `MarketOverview.js`, `SignalsFeed.js`                    |
| **Node.js Modules**        | `camelCase.js`              | `marketData.js`, `websocketClient.js`                    |
| **Go Source Files**        | `snake_case.go`             | `market_data.go`, `candle_aggregator.go`                 |
| **Go Test Files**          | `snake_case_test.go`        | `market_data_test.go`                                    |
| **Scripts**                | `snake_case`                | `backfill_history.sh`, `feed_kafka.js`                   |

### 💻 Code Artifacts

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

#### Database (SQL)

- **Tables**: `snake_case` (pluralized).
  - `market_ticks`, `user_orders`
- **Columns**: `snake_case`.
  - `created_at`, `symbol_name`, `last_price`

## 📦 Dependencies & Config

- **Networking**: All containers share `compose_trading-network`.
- **Ports**:
  - Dashboard: `3000`
  - API: `4000`
  - Gateway: `8088`
  - Grafana: `3001`
  - Kafka: `9092`
  - Redis: `6379`

## 🧪 Testing Guidelines

- **Unit**: Test core logic (Indicators, Strategies) in isolation.
- **Integration**: Use `docker-compose.infra.yml` to spin up dependencies for tests.
- **Mocking**: Mock external vendor APIs (MStock, Kite) to avoid rate limits.

---
