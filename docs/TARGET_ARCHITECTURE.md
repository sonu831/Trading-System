# Target Architecture — Options & Positional Trading Platform (North Star)

> **What this is:** the single north-star architecture for the whole platform — built backwards from the **end
> features & requirements** for **options + positional trading** on NIFTY/BANKNIFTY (and Nifty-50). It is
> **provider-agnostic**: brokers (Kite/MStock/FlatTrade), market-data feeds, and web-scraping / third-party
> sources all plug in as adapters you manage from the dashboard.
> **Status:** PLAN / decision record. Design only.
> **Created:** 2026-07-09
>
> **Ties together:**
> - [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md) — the strategy + adaptive framework (the *what to trade*)
> - [`SIMPLE_ROBUST_ARCHITECTURE_PLAN.md`](SIMPLE_ROBUST_ARCHITECTURE_PLAN.md) — provider registry, credential vault, layer simplification, hardening (the *how it's wired*)
> - [`OPTIONS_SCALPING_RULES.md`](OPTIONS_SCALPING_RULES.md) — optional low-latency execution path

---

## 1. End Features & Requirements — build backwards from these

Everything in the architecture exists to serve this list. If a component doesn't map to a requirement, cut it.

### 1.1 Functional capabilities (the "what the system must do")

**A. Data (market + alternative)**
- Live index spot ticks: NIFTY, BANKNIFTY (+ Nifty-50 constituents) — the trigger + breadth inputs
- **Option chain** for ATM±N strikes: LTP, bid/ask, **OI + OI change, IV, volume, greeks** — the tradable leg
- India VIX (volatility regime)
- Historical candles, multi-timeframe (1m/5m/15m/1h/Daily) for index, stocks, and options — backtest + indicators
- **Alternative / scraped data** (pluggable third-party sources): FII/DII flows, PCR, max-pain, global cues
  (GIFT Nifty, US close), news/event calendar (RBI, budget, results, expiry), sector indices

**B. Intelligence**
- Per-symbol indicators (RSI/MACD/EMA/Supertrend/ATR/VWAP) — *exists* (L4)
- Market breadth + sector rotation — *exists* (L5)
- **Multi-timeframe regime engine** — classify trend/vol/phase across 5m→Daily (enables positional)
- **Options analytics**: PCR, max pain, IV rank/percentile, **OI-buildup classification** (long/short buildup,
  unwinding, short-covering), greeks aggregation
- **Adaptive strategy framework**: pluggable strategies (scalp + positional), regime-routed, tunable
- **Backtesting + optimizer**: validate/optimize strategies per regime before live

**C. Execution**
- Order lifecycle: place / modify / cancel; types: market, limit, **SL-M**, IOC
- Strike selection + **expiry management** (weekly/monthly, roll rules)
- Position management: trailing SL, targets, time-stops, partial exits, **overnight (positional) handling**
- Risk management: position/day limits, **daily-loss circuit breaker**, margin checks, **kill switch**
- **Multi-broker execution** with failover (FlatTrade primary; MStock/Kite backup)
- Modes: **paper → shadow → live** (single switch)

**D. Control & Monitoring (all from the dashboard)**
- **Provider management**: add / edit / **enable / disable** / prioritize any data or broker provider
- **Strategy management**: enable/disable/tune strategies (per regime)
- **Risk configuration**: limits, sizing, cutoffs
- Live view: positions, orders, P&L, market regime, breadth
- **Manual override + kill switch** (dashboard + Telegram)
- Backtest / optimization control + results
- Alerts (Telegram) + observability (health, latency, metrics)

### 1.2 Non-functional requirements (the "how it must behave")

| Requirement | Meaning |
|-------------|---------|
| **Simple layers** | One job per layer, one input, one output. Nothing "confusing." |
| **Robust** | Idempotent consumers, auto-reconnect, fail-safe (never sit in an unprotected position) |
| **Provider-agnostic** | Any broker / feed / scraper plugs in behind an adapter; selected from the dashboard, not code |
| **Secure** | Secrets in an encrypted vault, TLS enforced, no secrets in code or images |
| **Event-driven + CQRS** | Kafka between layers; Redis for reads, TimescaleDB for writes |
| **Observable** | Prometheus/Grafana/Loki; latency + health per stage |
| **Controllable** | Everything configurable at runtime from the dashboard (no redeploy to change providers/strategies/risk) |

---

## 2. The One Big Idea — Control Plane vs Data Plane

The architecture cleanly splits into two planes. This is what makes it both **simple** and **fully
dashboard-controllable**.

```
╔══════════════════════════ CONTROL PLANE (you configure everything here) ═══════════════════════════╗
║  L8 Dashboard ──► L7 API ──► Config Store (TimescaleDB)  +  Command Bus (Redis pub/sub)             ║
║     • providers: add/edit/enable/disable/prioritize      • kill switch                              ║
║     • strategies: enable/disable/tune                    • mode: paper|shadow|live                  ║
║     • risk: limits/sizing/cutoffs                        • manual square-off                        ║
╚════════════════════════════════════════════════╤═══════════════════════════════════════════════════╝
                                                 │ every service reads its config + reacts to commands
╔════════════════════════════════════════════════▼══════════════ DATA PLANE (market data → order) ═══╗
║ DATA SOURCES ─► INGESTION ─► PROCESSING ─► ANALYSIS ─► REGIME/AGG ─► SIGNAL ─► EXECUTION ─► BROKER  ║
║   (adapters)      (L1)         (L2)          (L4)        (L5)          (L6)       (L10)              ║
║                                    └─────────► STORAGE (L3: TimescaleDB + Redis) ◄──────────┘        ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

- **Data plane** = the event-driven pipeline (Kafka). It moves and transforms market data into orders. Each layer
  has one job.
- **Control plane** = configuration + commands. The dashboard writes config to the DB and fires commands on a
  Redis bus; every data-plane service reads its config and obeys commands (enable a provider, disable a strategy,
  flip the kill switch) **without a redeploy**.

> Why this matters: "everything centralized and controllable from the dashboard" = the control plane. "Simple,
> robust layers" = the data plane. Keeping them separate is what prevents the confusion.

---

## 3. Data-Source Abstraction — brokers, feeds, AND scrapers all plug in

You said you'll link providers (Kite/MStock/FlatTrade) and possibly **web-scraping / third-party** sources. All of
them sit behind **one abstraction** with three adapter *kinds*. The pipeline downstream never knows or cares which
source produced a fact — it only sees normalized topics.

```
                         ┌──────────── L1 · DATA GATEWAY (single ingress) ────────────┐
                         │                                                            │
 Kite / MStock / FT  ───►│  [BrokerAdapter]   live ticks (WS) + historical + orders*  │──► raw-ticks
 NSE / option APIs   ───►│  [MarketDataAdapter] option chain, India VIX               │──► option-chain
 Scrapers / 3rd-party───►│  [AltDataAdapter]  FII/DII, PCR, max-pain, news, global    │──► alt-data
                         │                                                            │
                         │  all normalize to CANONICAL SCHEMAS (shared/)              │
                         └────────────────────────────────────────────────────────────┘
   * orders go OUT via L10 using the same BrokerAdapter contract — see §6
```

**Adapter kinds (one interface each, provider-agnostic):**

| Kind | Examples | Produces | Notes |
|------|----------|----------|-------|
| **BrokerAdapter** | Kite, MStock, FlatTrade | `raw-ticks`, historical, order I/O | Auth via central Session Service; used by L1 (data) **and** L10 (orders) |
| **MarketDataAdapter** | NSE option-chain API, VIX | `option-chain`, VIX | May be a broker or a public/third-party API |
| **AltDataAdapter** | web scrapers, news APIs, FII/DII sources | `alt-data` | Best-effort, lower cadence; **never** on any critical path — advisory only |

**Governed by the Provider Registry** (see [`SIMPLE_ROBUST_ARCHITECTURE_PLAN.md#47`](SIMPLE_ROBUST_ARCHITECTURE_PLAN.md)):
each source is a DB record you **add / edit / enable / disable / prioritize** from the dashboard. Priority drives
failover (the existing `CompositeVendor`). Credentials come from the encrypted **Vault**; sessions from the central
**Broker Session Service**. Adding a new scraper = new adapter + a registry row, nothing else changes.

> **Robustness rule for scraped/alt data:** it is *advisory context* (regime tint, event flags), **never** a hard
> trade trigger. Scrapers break; the system must degrade gracefully — if `alt-data` is stale, trading continues on
> price + breadth. Mark it stale, don't stop.

---

## 4. Data Plane — layers, one job each

| Layer | One-sentence job | In | Out |
|-------|------------------|----|----|
| **L1 Ingestion** | The single data gateway: pull from all enabled sources, normalize | Adapters | `raw-ticks`, `option-chain`, `alt-data` |
| **L2 Processing** | Build candles (multi-TF) from ticks | `raw-ticks` | `market_candles` |
| **L3 Storage** | Persist (writes) + serve fast reads — CQRS | topics | TimescaleDB + Redis |
| **L4 Analysis** | Indicators per symbol + **option analytics** (IV/OI/greeks/PCR/max-pain) | `market_candles`, `option-chain` | `analysis_updates` |
| **L5 Aggregation + Regime** | Breadth, sector rotation, **multi-TF regime state** | `analysis_updates` | `sentiment_scores`, `market-regime` |
| **L6 Signal** | Adaptive strategy framework → tagged signals | `market-regime`, `analysis_updates` | `trade-signals` |
| **L10 Execution** | Single order gateway: risk-gate → OMS → position mgmt | `trade-signals` | broker orders, `execution-events` |

Only **L1** (data in) and **L10** (orders out) ever touch a broker. Everything else is pure stream processing.

---

## 5. Intelligence Plane — the decision engine

Layered so each part is independently testable.

```
 market_candles + option-chain + alt-data
        │
        ▼
  ┌───────────────┐   ┌──────────────────────┐   ┌───────────────────────┐
  │ L4 Indicators │   │ L4 Option Analytics  │   │ L5 Breadth + Sectors  │
  │ RSI/MACD/EMA  │   │ IV rank, OI buildup, │   │ A/D, %>EMA, sector    │
  │ ATR/VWAP/ST   │   │ PCR, max-pain, greeks│   │ momentum              │
  └──────┬────────┘   └──────────┬───────────┘   └──────────┬────────────┘
         └────────────────────────┼──────────────────────────┘
                                  ▼
                    ┌─────────────────────────────┐
                    │ L5 MULTI-TF REGIME ENGINE   │  trend/strength/vol/phase across 5m→Daily
                    │  → RegimeState (market-regime)│  → decides which tiers/strategies are allowed
                    └──────────────┬──────────────┘
                                  ▼
                    ┌─────────────────────────────┐   controlled by the dashboard (enable/disable/tune)
                    │ L6 ADAPTIVE STRATEGY FRAMEWORK│  pluggable strategies, regime-routed:
                    │  • momentum-burst (scalp)     │   → trade-signals {tier, strategyId, CE/PE, strike, reasons}
                    │  • trend-pullback (positional)│
                    └──────────────┬──────────────┘
                                  ▼        ▲
                    ┌──────────────┴──────────────┐  (offline)  ┌──────────────────────────────┐
                    │ (to Execution)              │◄────────────│ Backtest + Optimizer (L9)    │
                    └─────────────────────────────┘             │ per-regime tuning, decay mon │
                                                                └──────────────────────────────┘
```

**Options-specific analytics (L4) — required for an options desk:**
- **IV rank / percentile** — is the option cheap or expensive right now?
- **OI-buildup classification** — long buildup / short buildup / short-covering / long-unwinding (price × OI change)
- **PCR + max pain** — positioning + magnet levels
- **Greeks aggregation** — net delta/theta exposure of open positions (positional theta management)

---

## 6. Execution Plane — the order gateway

Single layer (L10), single broker-facing surface, mode-aware.

```
 trade-signals ─► RISK GATE ─► STRIKE SELECTOR ─► OMS ─► POSITION MANAGER ─► journal
                    │              │               │           │
   (kill switch,    │   (ATM/ITM-1,│  (FlatTrade   │  (SL-M rest, trail,     ─► execution-events (Kafka)
    limits, margin, │    expiry,   │   primary,    │   target, time-stop,    ─► trades (TimescaleDB)
    daily loss)     │    liquidity)│   MStock/Kite │   overnight for T3)     ─► Telegram alerts
                    ▼              ▼   failover)    ▼
              reject/allow    resolve symbol   place/modify/cancel
```

- **One `BrokerAdapter` contract** shared with L1 (data): `placeOrder / modifyOrder / cancelOrder / getOrderBook /
  getPositions / getQuote`. FlatTrade-first; fail over by registry priority.
- **Modes** (`TRADE_MODE`): `paper` (simulated fills vs live LTP) → `shadow` (alerts only, you fire) → `live`.
- **Safety guarantees** (from `OPTIONS_SCALPING_RULES.md`): entry+SL atomic, broker-side resting SL-M, idempotent
  `ordertag`, order-book reconciliation, never naked.
- **Positional additions:** overnight carry only if regime valid; long-premium only (never sell); gap-aware stop;
  net-greeks awareness.

---

## 7. Control Plane — everything from the dashboard

The dashboard (L8) + API (L7) are the single control surface. Nothing is configured by editing `.env` or code.

| Control | Mechanism | Effect |
|---------|-----------|--------|
| **Providers** (add/edit/enable/disable/prioritize) | API → `broker_providers` + `broker_credentials` (encrypted) | L1/L10 rebuild active sources on `providers-changed` |
| **Broker sessions** (connect/re-login/logout) | API → Broker Session Service → Redis token | L1/L10 consume tokens; never log in themselves |
| **Strategies** (enable/disable/tune, per regime) | API → `strategy_config` | L6 router loads only enabled strategies |
| **Risk** (limits/sizing/cutoffs) | API → `risk_config` | L10 risk gate reads live values |
| **Mode** (paper/shadow/live) | API → config + command | L10 switches behaviour |
| **Kill switch / square-off** | Redis command bus (`execution:commands`) + Telegram | L10 halts entries / flattens positions instantly |
| **Backtest / optimize** | API → job in L9 | results back to dashboard for human-gated promotion |

**Config store = TimescaleDB** (durable, audited). **Command bus = Redis pub/sub** (instant). Services read config
at startup and subscribe to change events → **runtime reconfiguration, no redeploy**.

---

## 8. Cross-Cutting Concerns

- **Security:** encrypted credential vault (AES-256-GCM; KMS in prod), central session service, TLS enforced
  (remove the runtime `NODE_TLS_REJECT_UNAUTHORIZED=0`), secrets never in images (`.dockerignore` + docker secrets).
- **Observability:** Prometheus metrics per layer, Grafana dashboards, Loki logs; latency stamps on the execution
  path; health endpoints on every service.
- **Robustness:** idempotent Kafka consumers; auto-reconnect feeds; broker-side resting stops; alt-data failures
  degrade gracefully; `tini` for clean SIGTERM (graceful square-off).
- **Deployability:** hardened multi-stage Docker images, non-root, pinned bases, resource limits (see
  `SIMPLE_ROBUST_ARCHITECTURE_PLAN.md` §6).

---

## 9. Capability → Component Map (exists vs build)

| Capability | Component | Status |
|------------|-----------|--------|
| Broker adapters + failover | `layer-1-ingestion/src/vendors/*` (BaseVendor, Composite, factory) | ✅ exists |
| MStock TOTP auth | `vendors/mstock.js` | ✅ exists (centralize per §7) |
| Option-chain ingestion | `vendors/option-chain-poller.js` | 🟡 built, verify |
| Indicators + breadth + sectors | L4, L5 | ✅ exists |
| Multi-TF regime engine | L5/L6 | 🔨 build |
| Option analytics (IV/OI/PCR/max-pain/greeks) | L4 | 🔨 build |
| Adaptive strategy framework | L6 | 🔨 build |
| Backtest + optimizer | L9 + scripts | 🔨 build |
| Execution (OMS/risk/position/modes) | L10 | 🟡 scaffolded → finish |
| **Provider registry (enable/disable from UI)** | L7 + `broker_providers` | 🔨 build |
| **Credential vault + session service** | L7 + L3 + Redis | 🔨 build |
| **Alt-data / scraper adapters** | L1 `AltDataAdapter` + registry | 🔨 build |
| Dashboard control plane | L7 + L8 | 🟡 extend |
| Observability, Docker hardening | infra | 🟡 harden |

---

## 10. Roadmap (high-level; details in the sibling docs)

```
1. Hardening & control-plane foundation
   └── Docker/TLS hardening · credential vault · provider registry (enable/disable) · session service
2. Data completeness
   └── verify index multi-TF + option chain + VIX · add alt-data/scraper adapters
3. Intelligence
   └── regime engine · option analytics · adaptive strategy framework · backtest+optimizer
4. Execution
   └── finish L10 (paper→shadow→live), FlatTrade-first, positional profile
5. Validate → Shadow → Live (2–3 lots)
```

---

## 11. Decision Record

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-09 | Split Control Plane (config/commands) from Data Plane (market→order) | Enables full dashboard control while keeping layers simple |
| 2026-07-09 | One Data-Source abstraction with 3 adapter kinds (Broker / MarketData / AltData) | Brokers, feeds, and scrapers all plug in uniformly; downstream is source-agnostic |
| 2026-07-09 | Scraped/alt data is advisory only, never a hard trigger | Scrapers are fragile; system must degrade gracefully |
| 2026-07-09 | Provider selection is DB/dashboard-driven, not env vars | "Enable/disable/modify any provider from the dashboard" |
| 2026-07-09 | Options analytics (IV/OI/PCR/max-pain/greeks) are first-class in L4 | It's an options desk — these are required, not optional |
| 2026-07-09 | Two broker touchpoints only (L1 data, L10 orders) | Simplicity + robustness (single gateway) |

---

## 12. Hand-off

- **This is the north-star.** The two sibling docs hold the details: strategy/adaptive framework
  ([`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md)) and wiring/hardening/registry
  ([`SIMPLE_ROBUST_ARCHITECTURE_PLAN.md`](SIMPLE_ROBUST_ARCHITECTURE_PLAN.md)).
- **Owner to link providers:** Kite/MStock/FlatTrade credentials + any scraping/third-party endpoints → added via
  the provider registry once built.
- **Owner decisions still open:** prod secret store (env vs KMS); which alt-data sources to prioritize
  (FII/DII, PCR, global cues, news); single-account vs multi-user.
- **Not done / not pushed:** design only; no code changed, no git operations.
