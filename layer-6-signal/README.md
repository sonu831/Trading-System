# Layer 6 — Signal (Regime Engine + Strategy Framework)

> **One job:** Classify market regime across 4 timeframes, evaluate pluggable strategies, emit trade signals.
> **Tech:** Node.js 20 · **Port:** 8082

## Architecture

```
analysis_updates + sentiment_scores (Kafka/Redis)
    │
    ▼
Regime Engine ──→ Multi-TF Classification (5m, 15m, 1h, D)
    │                 trend · strength · volatility · phase · tiers
    ▼
Strategy Router ──→ Enabled Strategies (by regime affinity)
    │                 momentum-burst (T1) · trend-pullback (T2)
    ▼
trade_signals (Kafka) → L10 Execution
```

## Files

| File | Purpose |
|------|---------|
| `src/regime/engine.js` | Multi-TF regime classification + Redis/Kafka publish |
| `src/regime/indicators.js` | Pure JS: SMA, EMA, ATR, ADX, detectTrend, detectVolatility, detectPhase |
| `src/strategies/base.js` | `BaseStrategy` — `evaluateEntry()`, `managePosition()` contract |
| `src/strategies/orchestrator.js` | Main loop: fetches candles, builds context, runs strategies |
| `src/strategies/registry.js` | Strategy registry: register, get, enable/disable |
| `src/strategies/router.js` | Selects strategies by regime affinity + tradeable tiers |
| `src/strategies/plugins/` | momentum-burst (T1 scalp), trend-pullback (T2 intraday) |

## Adding a New Strategy

```js
// 1. Copy pattern from plugins/momentum-burst.js
// 2. Extend BaseStrategy with evaluateEntry(ctx) + managePosition(pos, ctx)
// 3. Register in orchestrator.js built-in list
// 4. Add to config.json (enable/disable + params)
```

## Key Constants

```js
const { REGIME_TREND, REGIME_VOLATILITY, SIGNAL_TIER, KAFKA_TOPICS } = require('/app/shared');
```

## Run

```bash
make layer6          # Local dev
npm test             # 10 regime indicator tests
```
