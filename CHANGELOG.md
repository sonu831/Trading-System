# Changelog

All notable changes to the **Nifty 50 Trading System** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 📋 Added — Wiring Audit & Fix Plan (2026-07-11)

- **`docs/WIRING_GAPS_AND_FIXES.md`** — code-verified architecture wiring audit + work order (dashboard → L7 command plane → layers). Findings: REST plane effectively complete (all ~20 frontend adapter endpoints exist in L7); realtime push plane largely dead — two competing WS relays (`plugins/websocket.ts` vs `services/SocketService.ts`) with mismatched room names; `market_ticks`, `option_chain_updates`, `execution:state`, `execution-events` have **no Redis publishers**; `signals` vs `signals:trade` and `notifications` vs `notifications:execution` channel mismatches; only `market-regime` push fully live. Command fan-out incomplete: `strategies-changed`/`risk-changed` published by L7 but **no consumer** in L6/L10 (`providers-changed` is the working reference pattern). Includes ordered fix plan, `REDIS_CHANNELS` shared-contract draft, acceptance criteria (incl. `scripts/verify-wiring.js` gate), and a stale-docs trust map. Marked `COCKPIT_BACKEND_PLAN.md` §4–§5 as superseded.
- **Wiring doc extended (same day):** §8 robustness/troubleshooting enhancements (R1–R14: correlation IDs, heartbeats, DLQ, outbox, circuit breakers, boundary schema validation, `@ts-nocheck` burn-down, `verify-wiring --live`, symptom runbooks, chaos drill); §9 broker-connection audit (GAP-E: no session refresh loop, silent IST-midnight expiry, presence≠liveness status, no auth single-flight, Kite daily-flow gap) + FIX-E plan; §10 DB/schema audit (GAP-F: dual schema authority SQL-vs-Prisma, `index_membership` population, missing control-plane tables, writer idempotency, attribution columns, restore drill).
- **`.ai/skills/wiring-gaps.md`** — new shared skill binding ALL AI tools to work the gap registry strictly (graphify-first, shared constants, one relay, assertion-per-fix); registered in the active work order in `.ai/MEMORY.md`; propagated to all 6 tool spokes via `npm run sync-ai`.
### 🐛 Fixed — Backfill restored + MStock no-data root cause (2026-07-13)

- **GAP-L1 — backfill was dead at step 1.** `scripts/backfill-runner.js` was TypeScript with a `.js` extension → `SyntaxError: Unexpected token '?'` the instant Node forked it. Renamed to `.ts`, spawned via `tsx` (`execArgv: ['--import','tsx']`), removed the `ts-node` shim (rule 15). The whole dashboard→L7→L1→runner chain now executes.
- **GAP-L2 — fail loud.** A failed job was marked `FAILED` with no reason; the operator had to read container logs. The error message is now written to the job + Redis status.
- **GAP-L4 — new CI gate `shared/tests/verify-script-syntax.test.js`**: `node --check` on every `.js` we ship. The existing `no-ts-js-twins` gate only caught a module existing as *both* `.ts` and `.js`, never TS *content* in a `.js`. The new gate immediately caught a second broken file (`batch_streaming.js` — orphaned, zero callers, and **broken in git HEAD**; needs an owner decision to delete or repair).
- **Regression introduced and fixed in-session:** the default-deny API broke the *forked* backfill child (it never runs `src/index.ts`, so it never got the axios interceptor → 401). Extracted `src/utils/internal-auth.ts` as the single source of truth and attached it in both the interceptor and the child (rule 14).
- **🔴 GAP-M1 — THE reason MStock could never fetch data (verified by decoding the live token).** MStock issues JWTs whose own `exp` claim gives them a **300-second** life; `BrokerSessionService` cached them until IST midnight (**~12 hours**). For virtually their entire cached life we served a token the broker had already invalidated, so every MStock call — ticks *and* backfill — returned `401 Invalid request`. `saveToken()` now **clamps the cache TTL to the token's own `exp`** (30s margin); an already-dead token is never cached as valid; opaque non-JWT tokens (FlatTrade jKey) keep their policy TTL. Guarded by 3 `M1:` asserts. *(Also disproved a stale comment claiming the MStock SDK omits `X-Mirae-Version` — the installed SDK sends it; the header was never the problem.)*
- **⚪ OWNER ACTION:** unattended re-auth is impossible because the stored `totp_secret` is **not valid Base32** (`stage: totp_secret`). With a 300s token, MStock *must* re-auth automatically — re-enter a valid Base32 secret from trade.mstock.com → Trading APIs → Enable TOTP.
- Suites: **146 passed, 0 failed** (113 broker-auth incl. 3 new TTL asserts + 20 api-auth + 13 execution-proxy).

### 🗄️ Added — Config in the database (migration 008)

- **`layer-3-storage/timescaledb/migrations/008_control_plane_config.sql`** (applied): `instrument_tokens` (per-broker symbol map — kills the file-based map whose silent fallback fed Kite tokens to MStock), `app_config` (typed runtime KV, seeded), `risk_config` (replaces `layer-10-execution/config/default.js`; separate scalp/positional loss budgets), `strategy_registry` (params **per regime bucket**), `alerts` (hypertable — backs `GET /api/v1/alerts`), `backtest_runs` (with a `net_of_costs` flag — a gross result is meaningless), `prediction_log` (hypertable; `ABSTAIN` is a first-class outcome). Documents the three bootstrap secrets that can never move into the DB (`DATABASE_URL`, `CREDENTIAL_MASTER_KEY`, `INTERNAL_API_KEY`).

### 📋 Added

- **`docs/BACKFILL_SYSTEM_PLAN.md`** — root-caused why dashboard backfill does nothing, **by executing it in the live container** (rule 12): `layer-1-ingestion/scripts/backfill-runner.js` is **TypeScript source with a `.js` extension** → `SyntaxError: Unexpected token '?'` → every backfill dies at step 1. Worse, L1 returns `{success:true}` *before* the child parses and `.catch`-logs the crash, so the dashboard shows a **green "started"** for a job that never ran (rule-13 fabricated success). `batch_streaming.js` fails `node --check` too; `ts-node` is installed in L1 (rule 15 forbids it) and `runScriptWithIPC` uses bare `fork()`, which cannot run TS at all. The `no-ts-js-twins` gate has a blind spot — it only catches a file existing as *both* `.ts` and `.js`, not TS *content* in a `.js`. Plan covers: fix + fail-loud + CI syntax gate, single event-driven trigger path (drop the L7→L1 direct HTTP, rule 4), **range fan-out** (`X→Y` ⇒ NIFTY + BANKNIFTY + 50 point-in-time constituents × trading-days, 1-min bars), idempotent writes, and populating the already-existing `data_availability` **coverage map** (first/last date, gaps, quality) + live WS progress. Registered as **GAP-L1–L8**.

### 🔒 Security

- **GAP-J1 — L7 API authentication bypass (CRITICAL).** The global auth hook called `fastify.authenticate()` **only when an `x-api-key` header was present**, so any request that simply omitted the header was served **unauthenticated** — including `GET /api/v1/providers/:provider/credentials/decrypted` (plaintext broker api_key / password / totp_secret) and `POST /api/v1/execution/kill|resume|square-off`. It also only covered `/api/v1`, leaving `/api/market/*` unguarded entirely. Now **default-deny**: everything outside `PUBLIC_API_ROUTES` (`/health`, `/metrics`, `/documentation`, `/swagger`, `/`) requires a valid key.
  - New `INTERNAL_API_KEY` service key (shared secret, constant-time compare, checked before the DB so L1/L10/dashboard never depend on a seeded `api_keys` row). **L7 refuses to boot without it** (rule 11 — no silent fallback to open access).
  - Callers wired to present it: dashboard via a **server-side Next.js `middleware.ts`** (never `NEXT_PUBLIC_*`; it also strips any client-supplied header so a browser cannot forge one), L1 via a **scoped** axios request interceptor, L10 via explicit headers. Scoping is deliberate — a blanket axios default header would have leaked the internal key to every **broker** API (MStock, FlatTrade).
  - **IP allow-listing deliberately NOT used:** Docker SNATs published-port traffic to the bridge gateway, so an internet client and the dashboard both arrive as `172.x` and are indistinguishable.
  - **`backend-api` port re-bound from `'4000:4000'` to `'127.0.0.1:4000:4000'`** — it was published on every host interface (LAN + any port forward). Containers still reach it as `backend-api:4000` over `trading-network`.
- **GAP-J4 — wildcard CORS.** REST (`origin: true`) and socket.io (`origin: '*'`) reflected **any** origin; combined with J1, any website the operator visited could drive the trading API from their browser. Both now allow-list `DASHBOARD_ORIGINS`.
- **Shared contract:** `API_KEY_HEADER` + `PUBLIC_API_ROUTES` added to `shared/constants.js` (+ `.d.ts`) — the header crosses four layers, and a sender/verifier mismatch would be a silent 401 storm (rules 3/14). Constants parity: PASS.
- **Regression tests:** new `tests/verify-api-auth.js` (**20 asserts**, wired into `pnpm run verify`) — no-header ⇒ 401, wrong/inactive key ⇒ 403, service key ⇒ authenticated, `/api/v1` and `/api/market` are not public, the vulnerable `if (req.headers['x-api-key'])` gate and both wildcard CORS patterns are gone from source, and every caller presents the key **only** to our own gateway. L7 suites: **143 passed, 0 failed** (20 api-auth + 110 broker-auth + 13 execution-proxy).
- ⚠️ **Still required before any public exposure:** J2 (TLS reverse proxy) and J3 (`/redirect` + `/postback` routes) — see wiring doc §13/§14.

### 🐛 Fixed

- **FlatTrade auth — GAP-K1 + K2 (L7 broker strategy)**, verified against the official Pi Connect docs (v2.0):
  - **K1 (wrong base URL):** `strategies/flattrade.ts` hardcoded `piconnect.flattrade.in/**PiConnectTP**/UserDetails` — the base that `shared/constants.js` explicitly flags as wrong (`/PiConnectAPI`). L1's `flattrade.js` was corrected during the P0 pass but L7's strategy never was, so every pre-generated-jKey validation hit a dead path. All three FlatTrade URLs (API base, auth API, portal) now import from `shared/constants.js` and **fail closed** if unresolvable (rules 11/14) — no hardcoded broker URLs remain in the strategy.
  - **K2 (hourly session expiry — 🟣 operational):** TTL was `secondsUntilNextISTHour` with no target hour ⇒ the Redis session cache expired at **every clock hour**. Since FlatTrade `canAuthenticateUnattended() === false`, this silently forced the operator to redo the browser login **every hour of the trading day**. TTL now runs to the broker's documented **06:00 IST token reset** (`secondsUntilNextISTHour(6, now)`) — a 09:30 IST login now lasts ~20h instead of ~30min.
  - **Regression tests:** new `F2` block in `tests/verify-broker-auth.js` — 6 named assertions (`K1:` base URL is `/PiConnectAPI` and `/PiConnectTP` is gone; `K2:` TTL survives the trading day at 09:30/14:00, expires at the 06:00 reset, and is no longer hourly). Suite: **110 passed, 0 failed**.

- **🚨 GAP-J logged — SECURITY: the L7 API is effectively unauthenticated (wiring doc §13):** `index.ts` L113–117 only calls `fastify.authenticate()` **when an `x-api-key` header is present** — a request with **no** header skips auth entirely, so every `/api/v1/*` route is open, including `GET /providers/:provider/credentials/decrypted` (plaintext broker api_key/password/totp_secret) and `POST /execution/kill|resume|square-off`. Compounded by **J4** CORS `origin: '*'` (any website can drive the trading API from the operator's browser) and **J2** no TLS. **J3:** no broker OAuth callback route exists (`/redirect`, `/callback`, `/auth/*` — none registered); FlatTrade's current flow is manual `request_code` paste. Raised in response to a plan to expose port 3029 on a public static IP — **public exposure blocked until J1/J2/J4 are fixed**; recommended registering a **localhost** redirect URI meanwhile. Fixes + regression test (no-header ⇒ 401) drafted.
- **🟣 GAP-I logged — root-caused "MStock fetches no data" (wiring doc §11):** three independent blockers, each sufficient alone. **I1 (🟣):** L7 `saveSessionToken()` publishes NO event; L1 `CredentialStore` gates `loadTokens()` behind a *provider-list* change so a new token is ignored; `VendorManager` reads the token only at vendor construction and **never calls `setAccessToken()`** (it is dead code, and mstock.js's comment claiming CredentialStore pushes tokens is false) → dashboard login never reaches a running vendor; L1 stays deaf until restart. **I2 (🔴):** `layer-1-ingestion/vendor` symlink is deleted, so `require('../vendor/nifty50_shared.json')` throws and silently falls back to `config/symbols.json` — which holds **Kite** tokens (RELIANCE 256265) while MStock needs **2885** → WS connects, subscribe accepted, zero ticks. Docker masks it via the `../../vendor:/app/vendor:ro` mount; local dev is broken. Violates rule 11 (never fall back silently). **I3:** one MStock-token list is broadcast to all vendors. **I4:** SDK drift (installed `subscribe(tokens[])` vs documented `subscribe(exchange, tokens[], mode)`; no feed mode selected). **I5:** `maxReconnectionAttempts: 0` is falsy → SDK uses 5. **I6:** process-wide `console` monkey-patch. Fixes + regression tests drafted; register now 48 gaps.
- **Cross-AI knowledge system completed:** `docs/INDEX.md` (master document map with trust levels, registered in `.ai/ai-manifest.json` readOrder, synced to all 6 tool spokes); `.ai/handoffs/2026-07-11-wiring-audit-and-planning.md` (session baton); `docs/MASTER_EXECUTION_PROMPT.md` (paste-ready phase 0–6 implementation prompt).
- **🟣 GAP-G6 logged (wiring doc §0.2):** cockpit pages render mockup dummy data as live — organisms have mockup numbers as default props (`AdvanceDeclineBar({ advancing = 38 … })`) rendered propless; pages bypass the existing `src/api/index.ts` adapters. Detailed paste-ready fix prompt + acceptance criteria added; MASTER_EXECUTION_PROMPT Phase 5 updated to do G6 first.
- **Master Gap Register + Execution Order (wiring doc §0/§0.1):** every known gap across all docs indexed with ID/status/fix-pointer — wiring A–D, broker E1–E6, DB F1–F8, frontend G1–G5 (taxonomies, AppShell, theme leaks, README examples, `@ts-nocheck`), predictive P0–P6, owner-action H1, enhancements R1–R14. Flags **P4 as a live rule-13 safety item**: `/api/v1/predict` proxies L9's untrained stub returning a hardcoded 0.65 — a fabricated prediction the UI can render; interim fix = L9 returns explicit abstain. Execution order: wiring §4 → broker §9 → command consumers → DB §10 → frontend design/restructure → predictive (P0-gated), with the P4 abstain fix allowed to jump the queue. Verified all cockpit pages now exist (predictions/internals/regime/signals/alerts/orders/settings/trading built by the concurrent integration pass).

### 🚀 Added — Cockpit Backend Integration (2026-07-10/11)

- **DB-Backed Credential Architecture** (Phase 1–5):
  - Eliminated `.env` broker credentials entirely. All secrets now managed via Dashboard → `broker_credentials` table (AES-256-GCM encrypted).
  - Added `deleteCredential` + `saveCredentialsBulk` endpoints (L7 API) with full CRUD via dashboard.
  - Added `GET /api/v1/providers/:provider/credentials/decrypted` — internal endpoint for L1/L10 to fetch live decrypted credentials.
  - Created `CredentialProvider` module in L10 execution — fetches providers + decrypted creds from L7 API, session tokens from Redis, subscribes to `providers-changed` for hot reload. **No `process.env` cred reads remain in L10.**
  - Refactored `MStockOMS` + `FlatTradeOMS` constructors to accept `CredentialProvider` — lazy credential resolution at `connect()` time.
  - Removed `MSTOCK_*`/`FLATTRADE_*`/`ZERODHA_*` env vars from all docker-compose files + `.env` + `.env.example`.
  - Session JWT now persisted to `broker_credentials.access_token` (encrypted) on every successful auth — survives Redis restarts.

- **Direct TOTP Login Flow** (MStock SDK):
  - Added `directLogin()` to mstock auth strategy — accepts user-provided 6-digit TOTP code via dashboard input, passes to `client.login({ totp })` in one step. No Base32 secret required for interactive auth.
  - Updated `completeSession` route schema to accept `totp` field. Dashboard test button now shows TOTP code input.
  - Auth status (`CONNECTED`/`ERROR`) + `last_tested_at` now written to `broker_providers` table on every auth attempt.

- **Unified Broker Form** (Dashboard):
  - Replaced `BrokerConfig` + `CredentialForm` with single `BrokerForm` component — role, priority, and all credential fields in one page with one **Save All Settings** button.
  - Added `api_secret` + `access_token` to credential dropdown. Added credential delete (×) button per field.
  - `MStockAuthFlow` → `BrokerAuthTest` — parameterized to work with any broker provider.
  - BrokerForm fetches decrypted credentials from L7 API on load (pre-fills real values, not masked).
  - Added `deleteBroker` + `deleteCredential` Redux thunks with optimistic state updates.

- **Shared Enums** (`shared/constants.js`):
  - `BROKER_CREDENTIAL_FIELDS`, `BROKER_REQUIRED_FIELDS`, `BROKER_FORM_FIELDS`, `BROKER_PROVIDERS` — single source of truth for provider metadata.
  - `REDIS_KEYS.ALERTS_FEED`, `REDIS_KEYS.STRATEGIES_CONFIG`, `REDIS_KEYS.RISK_CONFIG`, `REDIS_KEYS.SYSTEM_COMMANDS`, `REDIS_KEYS.PROVIDERS_CHANGED`.

- **Shared Auth Logger** (`shared/auth-logger.js`):
  - Color-coded structured auth tracing usable from any layer: `authLog.mstock.start/step/ok/fail/warn/data`.

- **Cockpit Backend Gaps Closed** (COCKPIT_BACKEND_PLAN.md):
  - `GET /api/v1/execution/orders` — L7 proxy to L10 journal (`order_log` hypertable). L10 added `GET /orders` Express route + `TradeJournal.getAll()`.
  - `POST /api/v1/backtest` — L7 proxy to L9 AI service.
  - `GET /api/v1/alerts` — notification feed from Redis `alerts:feed` list (filterable by severity).
  - `GET /api/v1/broker-strategies` now returns `meta` with providers, roles, credentialFields, formFields.

- **Socket.io Realtime Widened** (SocketService.ts):
  - 4 new rooms: `regime-stream` (L6 → market-regime), `exec-stream` (L10 → execution-events), `alerts-stream` (L8 → notifications), `breadth` on `market-stream` (L5 → market_view).
  - Previously only `tick` + `signal` were pushed.

- **Cockpit Frontend Integration**:
  - New API adapters: `OrdersApi`, `AlertsApi`, `BacktestApi`, `MarketViewApi`, `SystemApi` in `src/api/index.ts`.
  - New pages: `/orders` (Orders & Execution table with status badges), `/internals` (Market Internals — A/D meter, breadth metrics), `/regime` (trend, volatility, phase, confidence, tier enable/disable), `/alerts` (notification feed with severity filtering).
  - `cockpitSlice` extended: `execution`, `alerts`, `breadth` state + realtime WS handlers.
  - `useSocket.ts` wired for `execution`, `alert`, `breadth` events.

- **System Status Enhancement**:
  - `GET /api/v1/system-status` now returns `brokers` array (enabled providers with role + status + last_tested_at).

- **Docker Infrastructure**:
  - Unified all containers under single `trading-system` project name. Updated `.ai/skills/docker.md` with mandatory `--project-name` rule.
  - Removed broker credential env vars from all docker-compose services (execution + ingestion).
  - Fixed `pnpm-workspace.yaml` + `.npmrc` copy in dashboard Dockerfile.

### 🛠 Changed

- **L10 Config** (`config/default.ts`): Removed `mstock.apiKey`, `mstock.accessToken`, `mstock.clientCode`, `flattrade.userId`, `flattrade.accountId`, `flattrade.apiKey`, `flattrade.token` — kept only `baseUrl` + `endpoints`.
- **L1 Vendors**: `KiteVendor` now accepts `options.apiKey` + `options.sessionToken` constructor params. `CredentialStore` fetches decrypted static credentials from L7 in addition to Redis session tokens.
- **BrokerService**: Added `saveAccessToken()` (persist JWT to encrypted `access_token` credential) + `saveCredentials()` (bulk upsert) + `deleteCredential()`.
- **BrokerSessionService**: `applyResult()` now updates `broker_providers.status` + `last_tested_at` on every auth attempt. Generates `token_length` for dashboard (UI never sees raw token).
- **Piscina worker fix**: Copied `indicator.processor.ts` → `indicator.processor.js` on host to satisfy Piscina's `.js` requirement in Docker volume mount.

### 📚 Documentation

- Created `docs/COCKPIT_INTEGRATION_AUDIT.md` — 17-tab screen-to-API mapping with status per screen.

## [0.8.0] - 2026-01-25

### 🚀 Added

- **AI Market Intelligence (Layer 9)**:
  - **Ollama Integration**: Fully integrated Llama 3 for deep reasoning on Nifty 50 market trends.
  - **Advanced Sentiment**: Backend now produces "Bullish/Bearish/Neutral" labels using AI, replacing simple heuristic ratios.
  - **Market Summary**: AI-generated 2-sentence market condition summaries displayed in Dashboard and Bot.
- **Telegram Bot v4.0**:
  - **Hourly Market Insights**: Automatic background job that broadcasts AI-curated top picks to the admin channel every hour.
  - **Enhanced `/analyze`**: Now includes AI confidence scores and detailed reasoning/logic for every stock.
- **Maintenance & DevOps**:
  - **`make prune`**: New maintenance command with safety confirmation to aggressively reclaim disk space (verified to save 30GB+).
  - **Always-Build Policy**: Updated `make up` and `make ui` to enforce `--build`, ensuring code changes are always baked into containers.

### 🐛 Fixed

- **Critical Stability Fixes**:
  - **Go Analysis Engine**: Fixed a nil pointer dereference panic in `engine.go` when AI services were loading or unreachable.
  - **Layer 7 Connectivity**: Fixed `axios` dependency crash that prevented the API from booting in certain environments.
  - **AI Service Syntax**: Corrected a critical Python `SyntaxError` (extra parenthesis) in the Ollama engine module.
- **Data Flow Improvements**:
  - **Frontend Mapping**: Fixed `useDashboard.js` logic that was accidentally overwriting AI sentiment with local calculations.
  - **Port Consistency**: Standardized internal/external port 8081 for the analysis service.

### 🛠 Changed

- **Dashboard UI**:
  - Updated "Top Picks" widget to display dynamic scores and RSI values directly.
  - Integrated the new AI Market Summary panel.

## [0.7.0] - 2026-01-24

### 🚀 Added

- **Telegram Bot Features**:
  - **Live Status Command (`/livestatus`)**: Real-time market stream health (ticks/heap) with visual indicators. Added "⚡ Live Status" button.
  - **News Command (`/news`)**: Fetches latest market headlines from Backend API. Added "📰 Market News" button.
  - **Suggest Command (`/suggest`)**: Direct user feedback submission to database (`/suggest <text>`).
  - **Robust Routing**: Switched to Regex-based command matching (e.g., `/Market News/i`) to handle emoji variations gracefully.
  - **Incoming Logger**: Added debug middleware to trace incoming message routing.

- **Backend API Expansions**:
  - **Detailed Health Check (`GET /api/v1/health/detailed`)**: New endpoint reporting status of Redis, Database, AND Ingestion Service.
  - **Ingestion Heartbeats**: Checks `system:layer1:metrics` in Redis to determine if the Ingestion service is Active or Stale.
  - **News Endpoint (`GET /api/v1/news`)**: Mock endpoint serving financial news data.

### 🐛 Fixed

- **System Status "All Down" False Alarm**:
  - Fixed `health.controller.js` failing to ping Redis/DB by resolving dependencies correctly from the DI Container (`container.resolve('redis')`).
  - Updated Redis Health Check to use `redis.publisher.ping()` for the wrapped client.
- **Bot Connectivity**:
  - Updated `dev:local` script to force `BACKEND_API_URL=http://localhost:4000/api/v1`, fixing `ENOTFOUND` errors during local development.
- **Market Feed Crash**:
  - Patched `market.command.js` to handle partial market data (missing breadth) gracefully without crashing the bot.

## [0.6.2] - 2026-01-22

### 🚀 Added

- **Database Backup & Restore Commands**:
  - Added `make backup` command to create timestamped TimescaleDB backups in `./backups/`.
  - Added `make restore` command with interactive backup selection or latest auto-restore.
  - Backups are SQL dumps that persist across container restarts.

- **Container Resources Grafana Dashboard**:
  - Created comprehensive `container-resources.json` dashboard with CPU and Memory monitoring.
  - **Application Layers (L1-L7)**: Individual gauge panels for Ingestion, Processing, Analysis, Aggregation, Signal, API, Dashboard, and Telegram Bot.
  - **Infrastructure**: Kafka, Redis, TimescaleDB, Prometheus, Grafana, Loki, and pgAdmin memory gauges.
  - Time-series charts showing resource usage trends over time.
  - All panels display friendly container names instead of Docker IDs.

- **Prometheus cAdvisor Relabeling**:
  - Added `metric_relabel_configs` to extract `container_id` label from cAdvisor metrics.
  - Enables container-level resource filtering in Grafana queries.

### 🐛 Fixed

- **Layer 1 Ingestion Crash**:
  - Fixed `ReferenceError: marketHours is not defined` by moving `MarketHours` import before its first usage in VendorManager initialization.

- **pgAdmin Permission Issues**:
  - Changed from bind mount (`./data/pgadmin`) to named Docker volume (`pgadmin_data`).
  - Resolves macOS permission errors (`EACCES: permission denied`) that caused the container to crash-loop.
  - Data persists across `docker-compose down` but is managed internally by Docker.

### 🛠 Changed

- **Makefile Enhancement**:
  - Added `💾 DATABASE` section to help menu with backup/restore documentation.

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

### 🗄️ Database

- **Extended Database Schema (v2)**:
  - Created `layer-3-storage/timescaledb/migrations/002_extended_schema.sql` with 22 tables across 6 domains.
  - Added continuous aggregates: `candles_1h`, `candles_1d` for automatic rollups.
  - Added **Data Watermark System**: `data_availability` table to prevent duplicate ingestion.
  - Added **Reference Data**: `instruments`, `sectors`, `trading_calendar` tables.
  - Added **User Data**: `users`, `user_alerts`, `user_watchlists` tables.
  - Added **Billing**: `plans`, `subscriptions`, `payments`, `invoices` tables for future monetization.
  - Added **System**: `backfill_jobs`, `system_config`, `audit_log` tables.

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
