# Momentum Trading Architecture — NIFTY / BANKNIFTY (Scalping + Positional)

> **What this is:** the architecture/decision record for an automated **momentum** options module on
> NIFTY & BANKNIFTY, covering both **scalping** (seconds–minutes) and **positional** (hours–days) profiles.
> **Status:** IMPLEMENTED (Phases A–E built 2026-07-09). No live trading until the validation roadmap (§12) passes.
> **Created:** 2026-07-09
> **Build log:** See [`PROJECT_STATE.md`](../PROJECT_STATE.md) for detailed status per component.
>
> **Read alongside:**
> - [`docs/OPTIONS_SCALPING_RULES.md`](OPTIONS_SCALPING_RULES.md) — the low-latency execution engine (Layer 10). **Authority for the scalping hot path.** This doc does not re-derive it.
> - [`layer-1-tradingview/strategies/nifty-banknifty-trend-pullback.md`](../layer-1-tradingview/strategies/nifty-banknifty-trend-pullback.md) — a mechanical trend-pullback signal spec (complementary strategy).

---

## 1. Thesis — Why This Can Work (and where the edge is)

Index-option momentum trading makes money when you are **on the right side of a real directional move**
and you **cut theta-bleeding stalls fast**. Two things usually kill it: (a) fakeout breakouts on the index,
and (b) slippage/theta on the option leg. The design attacks both.

**The moat is data we already collect.** We ingest all 50 NIFTY constituents and already compute per-stock
momentum (Layer 4) and market breadth + sector rotation (Layer 5). That gives a confirmation signal most
retail index traders don't have:

> **Breadth-Confirmed Momentum** — a NIFTY breakout is only tradeable when its *own constituents* confirm it.
> If NIFTY prints a green breakout candle but only 22/50 stocks are advancing and the heavyweight sectors
> (banks, IT, energy) are flat, that move is suspect → **skip**. If 40/50 are advancing, % above VWAP is
> rising, and 3 of the top-4 weighted sectors are `STRONG_UP` → the move is real → **take it**.

This single filter is the difference between a coin-flip momentum entry and a positive-expectancy one. It is
**already computed** in [`breadth.go`](../layer-5-aggregation/internal/breadth/breadth.go) and
[`aggregator.go`](../layer-5-aggregation/internal/aggregator/aggregator.go) — we just need to *consume* it as a
gate.

---

## 2. Timeframe Tiers — One Momentum Core, Three Trade Types

The momentum *logic* is identical across the board (regime → trigger → confluence → managed exit). What differs
is the **timeframe of the move we're trying to capture**, the holding period, and the option we buy. Per the owner:
we trade **momentum on closed candles** and **some execution lag is acceptable** — we are capturing 1-minute to
multi-hour moves, not sub-second tick edges.

| | **T1 · Scalp** | **T2 · Intraday Momentum** | **T3 · Positional** |
|---|---|---|---|
| Move we capture | 1–5 min bursts | 10–30 min swings | 1h → multi-session trends |
| Trigger timeframe | 1m / 5m | 10m / 15m | 30m / 1h |
| Context / regime TF | 5m + breadth | 15m + breadth | 1h + Daily + breadth |
| Holding period | ~1–15 min | ~30 min – few hrs | hours → 1–3 days (overnight OK) |
| Instrument | **ITM-1** (high delta) or ATM, current weekly | ATM / ITM-1, current or next weekly | ITM-1 / ATM, **next weekly or monthly** (less theta) |
| Stop / target | premium: SL ~18% / TGT ~25–40% | premium + index-ATR blend | index-ATR + premium fallback −35% |
| Exit drivers | target, trailing, **momentum-fade**, time-stop, 15:15 | structure break, breadth reversal, ATR stop | breadth/sector reversal, ATR stop, EOD-only if regime holds |
| Execution path | event pipeline (default) · hot path optional | event pipeline | event pipeline |

### 2.1 Execution model — lag is acceptable, so default to the event pipeline

Because the owner accepts lag, **all three tiers run on the existing candle-close Kafka pipeline by default**:
Layer 6 emits a `trade-signals` message on candle close → Layer 10 executes. This reuses everything we already
have and keeps the build simple and fully backtestable (signals fire on *closed* candles).

- **The hot path (direct WS, in-process trigger, Kafka bypass) becomes an OPTIONAL UPGRADE** — worth it only if
  the T1 scalp later needs intra-candle 1m entries. It is fully specified in
  [`OPTIONS_SCALPING_RULES.md`](OPTIONS_SCALPING_RULES.md); we do **not** need it for v1.
- **Order execution is still latency-hardened** regardless of tier: FlatTrade-first, persistent connection,
  broker-side resting SL-M, marketable-limit entry. "Lag acceptable" applies to the *decision* cadence
  (candle close), **not** to leaving a position unprotected.

> **Design consequence:** v1 is dramatically simpler than the original scalping doc assumed. One event-driven
> signal→execution path serves all three tiers; the hot path is a later optimization, not a prerequisite.

---

## 3. The Momentum Strategy (mechanical rules)

All conditions on **closed candles** (no intra-candle signals) except the scalp trigger, which may use the
forming 1m candle with a confirmation buffer. Times are IST.

### 3.1 Regime (recomputed every candle from Layer 5 breadth + sectors)

| Regime | Condition (all) |
|---|---|
| **BULLISH** | `advance_decline_ratio > 1.5` **and** `percent_above_ema20 > 60` **and** `market_sentiment ∈ {BULLISH, STRONGLY_BULLISH}` **and** ≥2 of top-4 weighted sectors `momentum ∈ {UP, STRONG_UP}` |
| **BEARISH** | mirror (A/D < 0.67, %aboveEMA20 < 40, sentiment bearish, sectors DOWN) |
| **NO-TRADE** | anything else → chop; do not trade momentum in chop |

> Fields map 1:1 to `BreadthMetrics` and `SectorMetrics` that Layer 5 already publishes. For BANKNIFTY, weight
> the regime toward the banking sector + top constituents rather than the full NIFTY-50 breadth.

### 3.2 Entry trigger (on the index spot, direction = regime)

**Long → BUY CE** (regime BULLISH, all true):
1. Time window: scalp 09:20–15:00 (skip first 5m); positional 09:30–14:30.
2. Momentum ignition: `close > EMA21` **and** `close > session VWAP` **and** `RSI-14 > 55` **and** `MACD histogram > 0`.
3. Breakout: current candle closes above the higher of {prior swing high, opening-range high}.
4. **Breadth still confirming at trigger** (not just at regime calc): A/D ratio not falling, %aboveVWAP rising.
5. Volatility gate: ATR-14 ≥ floor (skip dead tape); India VIX within tradeable band (see §3.4).

**Short → BUY PE:** exact mirror (regime BEARISH, RSI < 45, MACD hist < 0, breaks below range low).

> **Never sell options.** Long premium only = defined risk. This is a hard rule for both profiles.

### 3.3 Instrument selection (reuses Layer 10 strike-selector design)
- **Strike:** ATM = round(spot / strikeStep) · strikeStep (NIFTY 50, BANKNIFTY 100). Scalp may use ITM-1 for
  higher delta; positional prefers ITM-1 to reduce theta/IV-crush sensitivity.
- **Expiry:** scalp = current weekly (roll to next after the configured cutoff on expiry day). Positional =
  next weekly with ≥ 2 sessions left, or monthly.
- **Liquidity gate:** reject if bid-ask spread > `maxSpreadPct` of premium or OI < `minOpenInterest`
  (already in [`default.js`](../layer-10-execution/config/default.js)).

### 3.4 Momentum-specific filters
- **India VIX regime:** ultra-low VIX → scalp premiums too thin / chop risk; ultra-high VIX → size down,
  widen stops. Add VIX to the ingestion feed (§6).
- **ATR floor:** NIFTY ≈ 12 pts, BANKNIFTY ≈ 29 pts on the trigger TF — skip dead chop.
- **Event-day guard:** flag RBI / Budget / Fed / election / expiry-day and require manual confirm (engine
  flags, human decides) — matches the trend-pullback spec.

### 3.5 Exits

| Exit | Scalp | Positional |
|---|---|---|
| Target | +25% premium (config `targetPct`) | 2R–3R on index, or sector/breadth momentum peak |
| Trailing | ratchet SL after +12%, in 6% steps (config) | trail under swing structure (higher-lows) |
| Hard stop | −18% premium (config `stopLossPct`) | index ATR stop **and** premium fallback −35% |
| **Breadth-reversal exit** | A/D flips against you intraday → exit | daily breadth/sector momentum reverses → exit |
| Time / session | time-stop ~10 min stall; 15:15 square-off | hold overnight **only** if regime still valid at 15:15; else exit |

The **breadth-reversal exit** is the momentum edge on the way out too: leave when the constituents stop
confirming, often before price rolls over.

### 3.6 Recommended "best" scalping strategy — Momentum-Burst Continuation

This is the concrete T1 strategy to build and validate first. It is designed specifically for **buying options
on fast 1–5 min moves** — the regime where option buyers make asymmetric returns *if* they cut stalls ruthlessly.

**Why this one:** option buying loses to theta + IV crush on chop. The only way it wins consistently is to
enter *only* on genuine momentum expansion, confirmed by breadth, and exit the instant momentum fades. This
strategy encodes exactly that.

#### Setup (all evaluated on the **5m** trigger candle, regime from 15m + breadth)

**Long → BUY CE** (mirror for PE), all must be true at 5m candle close:

1. **Regime BULLISH** (§3.1) — 15m trend up **and** breadth confirming (A/D > 1.5, %aboveVWAP rising).
2. **Momentum burst** — the trigger candle is an *expansion* candle:
   - range ≥ **1.5 × ATR-14(5m)** (a real thrust, not a drift), **and**
   - close in the **top 25%** of the candle's range (buyers in control into the close), **and**
   - volume ≥ **1.2 ×** the 20-candle average (participation behind the move).
3. **Structure break** — close above the higher of {prior 5m swing high, opening-range high, VWAP} — i.e. it's
   breaking *into* space, not into overhead supply.
4. **Momentum oscillators aligned** — RSI-14(5m) crossing up through ~55 (rising, not already >75/exhausted),
   MACD histogram > 0 and expanding.
5. **Not extended** — price not already > **2 × ATR** above VWAP (don't buy the top of a spike; chasing an
   exhausted move is the #1 option-buyer killer).
6. **Vol/liquidity gates** — India VIX in tradeable band; option bid-ask ≤ `maxSpreadPct`, OI ≥ `minOpenInterest`.

#### Instrument
- **ITM-1** by default (delta ~0.6): premium tracks the index move closely and bleeds less to theta over a
  10-minute hold — better for *capturing the move* than a cheap OTM lottery ticket. ATM as a config-switch when
  cheaper leverage is wanted and VIX is moderate. Current weekly expiry.

#### Management (the part that creates the edge)
- **Hard SL:** −18% premium, resting at broker as SL-M from the moment of fill (never naked).
- **Target:** +25–40% premium (config); momentum bursts that work tend to pay fast.
- **Trailing:** once +12%, ratchet the SL up in 6% steps (modify the resting order).
- **Momentum-fade exit (key):** exit *immediately* — even in profit — if on a 1m/5m close the move loses its
  engine: RSI crosses back below 50, or price closes back below VWAP/EMA21, or a 5m candle closes in the
  bottom 40% of its range after entry. Don't give a stalled scalp back to theta.
- **Time-stop:** if the trade hasn't moved in your favour within **~10 min**, exit — a burst that doesn't follow
  through is a failed thesis.
- **Breadth-reversal exit:** intraday A/D flips against you → exit.

#### Entry timing under "lag acceptable"
Enter at the **5m candle close** via the event pipeline (simple, fully backtestable). If forward testing shows
we're consistently late on the fastest bursts, the optional **hot-path upgrade** lets us trigger on the forming
1m candle instead — but only if the data proves it's needed.

### 3.7 Where "high returns" actually come from (be honest)

High returns are **not** from taking more trades or from speed. They come from the expectancy engine:

- **Asymmetric winners:** let confirmed momentum run with the trailing stop; the occasional +60–150% premium
  winner is what pays for the many small losers. Do not cap winners early.
- **Small, controlled losers:** the −18% hard stop + momentum-fade + time-stop keep the average loss small. An
  option buyer's ruin is holding losers hoping they come back while theta bleeds them.
- **Trade only A+ setups:** breadth-confirmed, non-extended bursts. Skipping mediocre setups raises win-rate and
  slashes the theta tax of being in the market on chop days.
- **Size up with conviction (2–3 lots):** when regime + breadth + burst all strongly align, size toward the
  upper end; when marginal, take fewer lots or skip. Risk stays capped by the daily-loss circuit breaker.
- **Compounding by profile:** T1 scalps generate frequent small edges; T3 positional captures the big multi-day
  moves. Running both smooths the equity curve — scalps pay the bills on range days, positional catches trends.

> **Reality check:** even a good option-buying momentum system wins ~40–50% of trades; profitability comes from
> win-size ≫ loss-size. The validation roadmap (§12) exists to prove the expectancy is positive *after real
> slippage and theta* before any meaningful size.

> **Important framing:** the strategy in §3.6 is **the first plugin, not the fixed answer.** We do not assume we
> know the best strategy up front. The system below (§3.8–§3.10) is built so strategies can be **added, swapped,
> tuned, and retired** as the market changes, and so the engine **reads the market regime across major
> timeframes** and routes to whatever strategy fits — including enabling positional trades when the higher
> timeframes align.

### 3.8 Adaptive Strategy Framework — strategies are pluggable, never hardcoded

The single most important architectural decision for longevity: **no strategy is baked into the code.** Each
strategy is a self-contained plugin described by declarative parameters (stored in config/DB, versioned), and
the engine loads whichever are enabled.

**Strategy plugin interface** (same shape for scalp and positional):

```
Strategy {
  id, version, tier (T1|T2|T3), enabled,
  regimeAffinity: [ regimes this strategy is ALLOWED to fire in ],   // e.g. ["TREND_UP","TREND_DOWN"]
  params: { ...thresholds... },                                       // SL%, target%, ATR mult, RSI level, etc.
  evaluateEntry(ctx) -> Signal | null,      // ctx = multi-TF candles, indicators, breadth, sectors, regime, VIX, chain
  manage(position, ctx) -> Action           // hold | trail | exit(reason)
}
```

- **Registry + config:** strategies registered by id; enable/disable and re-parameterise **without redeploying**
  code. `momentum-burst` (§3.6) is the first entry; `trend-pullback` (existing spec) is the second.
- **Regime affinity:** each strategy declares which regimes it may trade. The router (below) only offers a
  strategy the market states it's good at — a breakout strategy never fires in a defined range, etc.
- **Parallel shadow evaluation:** several strategies can run in **shadow** at once on live data; the journal
  records each one's would-be trades so we compare real expectancy and **promote winners / retire laggards**.
- **Regime-conditioned params:** the same strategy can carry different parameter sets per regime (wider stops in
  high-vol, tighter targets in low-vol).

### 3.9 Multi-Timeframe Regime Engine — "understand the market moment"

A **first-class module** whose only job is to classify *what kind of market this is right now*, across the major
timeframes, so the system knows which trades are even appropriate. This is what makes positional trading possible
and keeps scalps out of chop.

**Inputs:** index structure on 5m / 15m / 1h / **Daily**; the Layer 5 **breadth + sector** output; **India VIX**;
optionally the TradingView MCP bias.

**Output — a `RegimeState`** (published to a new `market-regime` Kafka topic + cached in Redis for fast reads):

```
RegimeState {
  timestamp, symbol,
  trend:      TREND_UP | TREND_DOWN | RANGE | REVERSING,
  strength:   0..1,                       // how clean/strong the trend is
  volatility: LOW | NORMAL | HIGH,        // from ATR percentile + India VIX
  phase:      TRENDING | CONSOLIDATING | BREAKOUT | EXHAUSTION,
  tfAlignment: { "5m":±1, "15m":±1, "1h":±1, "D":±1 },   // are the timeframes in agreement?
  breadthState, sectorLeaders[],
  tradeableTiers: [T1?, T2?, T3?],        // which tiers are allowed right now
  confidence: 0..1
}
```

**What it drives:**

- **Tier gating** — strong multi-TF trend + confirming breadth → **T3 positional enabled**; clean intraday trend
  → T2; only short bursts in an otherwise flat tape → T1 only; ambiguous/high-VIX chop → **stand aside**.
- **Strategy routing** — the router picks enabled strategies whose `regimeAffinity` matches the current
  `RegimeState`. This is the "adapt to the market" mechanism.
- **Risk scaling** — HIGH volatility → smaller lots, wider stops; strong aligned trend → allow upper-end sizing.

**Positional trades come directly from this engine:** when 1h **and** Daily align with breadth and sector
leadership, the regime engine opens a positional window and the router activates a T3 strategy — held across
sessions while the regime persists, exited when `tfAlignment` or breadth breaks.

### 3.10 Adaptation & Optimization Loop — the strategy improves itself (human-gated)

```
   stored candles + breadth history + recorded option snapshots
                     │
                     ▼
            ┌──────────────────┐   walk-forward / grid / Bayesian (optionally ML in Layer 9)
            │ Backtest harness │──────────────────────────────────────────────┐
            └──────────────────┘                                               │
                     ▲                                                          ▼
                     │                                            ┌───────────────────────────┐
      live results   │                                            │ Optimizer: propose params  │
   (trades hypertable)│                                           │ PER REGIME bucket          │
                     │                                            └───────────────┬────────────┘
            ┌──────────────────┐                                                  │ proposed params
            │ Decay monitor    │  live expectancy drifting < backtest?            ▼
            │ auto-demote to   │◀───────────────────────────────    ┌───────────────────────────┐
            │ shadow + alert   │                                    │ Auto-validate in PAPER/    │
            └──────────────────┘                                    │ SHADOW → report expectancy │
                                                                    └───────────────┬────────────┘
                                                                                    │
                                                              ┌─────────────────────▼─────────────────┐
                                                              │ HUMAN-APPROVED promotion to LIVE       │
                                                              │ (params are NEVER auto-pushed to live) │
                                                              └────────────────────────────────────────┘
```

- **Regime-conditioned optimization:** parameters are optimized *separately per regime bucket*, so the system
  adapts as market character changes rather than fitting one average.
- **Decay detection:** if a live strategy's expectancy drifts below its backtest, auto-demote it to shadow and
  alert — strategies decay; the framework assumes it and reacts.
- **Safety rail:** optimization and shadow promotion are automatic; **promotion to live is always human-approved.**
  We never let an auto-tuner change what trades real money without sign-off.

### 3.11 Predictive Model — Breadth-Based Index-Move Prediction (Layer 9)

> **What it is:** a *predictive* layer that forecasts the **next NIFTY / BANKNIFTY move** from (a) the live
> movement of the **50 constituents** (breadth, sector rotation, heavyweight contribution) and (b) **historical
> patterns** — *"when the index and its internals looked like this before, here is what happened next."*
> Industry names: **Predictive Analytics / Breadth-Based Index Prediction** (the bottom-up, constituent side) +
> **Analog Forecasting / Sequence Modelling** (the historical-pattern side). One model family, two heads — a
> short-horizon head for scalps, a long-horizon head for positional.

**It is a confluence input, never a standalone trigger.** The prediction raises or lowers *conviction and
sizing* on top of the mechanical momentum rules (§3.6) and the regime gate (§3.9). A model score never fires a
trade by itself — long-premium entry still requires the breadth-confirmed momentum trigger. This keeps the
system explainable and fail-safe, and means a bad model degrades sizing, not safety.

**What it predicts (per horizon):**

| Head | Horizon | Feeds |
|---|---|---|
| Scalp head | next 1–5 min direction + magnitude | T1 confluence / sizing |
| Positional head | next N hours–sessions trend probability | T3 tier-enable + conviction |

Output = calibrated probability of **UP / DOWN / FLAT** + expected move size + confidence, tagged with the
horizon and the top contributing features (for `trade-signals.reasons[]`).

**Feature set (the moat — the 50 stocks + internals, not just index price):**

- Index (NIFTY/BANKNIFTY) OHLCV + RSI/MACD/EMA/VWAP/ATR on 5m / 15m / 1h.
- **Breadth:** A/D ratio, %aboveVWAP, %aboveEMA20, breadth thrust (Δ) — from `breadth.go`.
- **Sector momentum:** the top-4 weighted sectors' state — from `aggregator.go`.
- **Heavyweight contribution:** index-points push of the top ~10 constituents (weight × %move).
- **Options:** PCR, change-in-OI at ATM±N, IV — from the `option-chain` topic.
- **Volatility / regime:** India VIX, ATR percentile, `RegimeState` (§3.9), `tfAlignment`.
- **Sequence window:** the last *N* candles of the above (an LSTM consumes a time series, not a single row).

**Label:** forward index return over the horizon, bucketed UP/DOWN/FLAT (plus an optional magnitude head),
computed with strict **no-lookahead** and IST session/expiry handling.

**Edge reality & data traps (research review 2026-07-11) — read before trusting any backtest:**

- **Survivorship bias is the #1 trap.** NIFTY-50 membership rotates ~every 6 months (~20+ names over 10y).
  Breadth features MUST be computed from **point-in-time constituent lists + historical free-float weights**
  (NSE reconstitution announcements / a point-in-time membership vendor). Today's 50 names against old index
  data = fiction.
- **Breadth is contemporaneous, not predictive.** When NIFTY moves 1%, breadth tells you the *quality* of that
  move, not tomorrow's direction. The forecasting power lives almost entirely in **index-vs-internals
  divergences** and is modest — think ~52–55% hit rate, regime-dependent, not a crystal ball.
- **Positional first; scalp is hard.** Breadth's real edge is **positional** (days–weeks): e.g. index at a new
  high while %above-50DMA is falling → a decent swing signal. At second-to-minute scalp horizons breadth is too
  slow — short-horizon index price is driven by **order flow, futures basis, and the option chain (ΔOI, IV
  skew)**, which the FlatTrade option-chain poller already ingests. Treat the scalp head as a stretch goal, not v1.
- **Options costs eat weak edges.** STT + bid-ask + slippage + theta can exceed a 0.1% directional edge. Every
  backtest must be **net of realistic option round-trip cost**, or it is meaningless.

**Honest current status (verified in code 2026-07-11, not assumed): SCAFFOLDED, NOT FUNCTIONAL.**

| Piece | State |
|---|---|
| `POST /predict` API + engine abstraction (`BaseEngine`) | ✅ exists — `layer-9-ai-service/app/main.py`, `.../core/engine.py` |
| `FeatureVector` | ⚠️ only 6 technical fields (rsi, macd, ema50, ema200, close, volume) — **no breadth / constituents / options / regime** |
| `LSTMModel` | ⚠️ declares `input_size=14` but `FeatureVector` supplies 6 (**contract mismatch**); **untrained** — `predict()` returns a hardcoded `0.65` dummy (`v1.0.0-lstm-untrained`) |
| Training data / pipeline / weights | ❌ none — no labeled dataset, no training loop, no saved `.pth` |
| Wiring into L6 strategy / regime | ❌ none — the prediction is not consumed anywhere |

**Build phases (new — none built yet):**

0. **Prove the edge cheaply first — before any ML.** A daily-bar breadth study on **point-in-time constituents**: compute 4–5 breadth features, test one rule (*fade narrow 1% moves / follow broad ones*) over ~10y **net of realistic costs**, **walk-forward** (never a single random split). Proceed to the ML pipeline below only if a small, stable, post-cost edge survives. Skipping this — training an LSTM on survivorship-biased data — is exactly how you get a beautiful backtest that dies live (rule 12).
1. **Feature contract** in `shared/` — expand `FeatureVector` to the set above; make it the single source of truth; fix `input_size` to match.
2. **Dataset + labels** — build (feature-window → forward-return) samples from stored candles + breadth history + option-chain snapshots (L3 TimescaleDB).
3. **Training** — LSTM **and** a simple baseline (logistic / gradient-boost), walk-forward, **per-regime buckets** (§3.10); save versioned weights + scaler + feature manifest. Score on **trading expectancy**, not just accuracy.
4. **Serving** — real `PyTorchEngine.predict`: load weights, transform features, output calibrated prob + magnitude + horizon; **fail-closed** on feature/model mismatch (rule 11) — abstain, never emit a fabricated score (rule 13).
5. **Integrate** — L6 fetches the score and uses it as a confluence/sizing input to §3.6 and a tier-confidence input to §3.9; tag it in `reasons[]`; surface it in `AIPredictionPanel`.
6. **Validate before it counts** — must beat a naive baseline and show positive expectancy in backtest/paper **before** it influences sizing; promotion to live is human-gated (§3.10); decay auto-demotes it.

> **Reality check:** a predictive model is an *edge amplifier*, not a crystal ball. On noisy index data a good
> model nudges win-rate and sizing by a few points — valuable compounded, dangerous if trusted blindly. That is
> why it gates *conviction*, not the *trigger*, and why it must pass the same validation roadmap (§12) as any
> strategy before it touches live sizing.

---

## 4. What Already Exists vs What We Build

Grounded in the knowledge graph (graphify) — not assumptions.

### ✅ Reuse as-is
| Component | File | Role in momentum module |
|---|---|---|
| Per-stock indicators + scores | `layer-4-analysis/internal/analyzer/engine.go` | Feeds breadth; also index-level indicators |
| Indicator library (RSI/MACD/EMA/Supertrend/ATR/VWAP/BBands) | `layer-4-analysis/internal/indicators/indicators.go` | Trigger computations |
| **Breadth engine** | `layer-5-aggregation/internal/breadth/breadth.go` | Regime gate (§3.1) |
| **Sector rotation** | `layer-5-aggregation/internal/aggregator/aggregator.go` | Regime gate (§3.1) |
| Execution config (TRADE_MODE, risk, strike, SL/target) | `layer-10-execution/config/default.js` | Scalp + positional params |
| Signal API surface | `layer-7-core-interface/api/src/modules/signals/` | Expose signals to dashboard/bot |
| Telegram bot (alerts, `/kill`) | `layer-8-presentation-notification/telegram-bot/` | Notifications + kill switch |

### 🔨 Build new
| Component | Where | Why |
|---|---|---|
| **Multi-TF Regime Engine** | `layer-5-aggregation/` (extends breadth) or new `layer-6-signal/regime/` | Classifies market state across 5m/15m/1h/Daily + breadth + VIX → `RegimeState` on `market-regime` topic (§3.9). Gates tiers, routes strategies, scales risk |
| **Adaptive Strategy Framework** | `layer-6-signal/strategies/` (registry + router) | Pluggable strategies with regime-affinity; enable/tune without redeploy (§3.8). Hosts `momentum-burst` + `trend-pullback` as first plugins |
| **Index-momentum signal generator (first plugin)** | `layer-6-signal/strategies/momentum-burst` | Consumes index candles + breadth + sectors + regime; emits `trade-signals` for CE/PE tagged `tier` + `strategyId` + `reasons[]` |
| **Parameter Optimizer + Decay Monitor** | `layer-9-ai-service/` (Python) + `scripts/` | Walk-forward/Bayesian tuning per regime bucket; auto-demote decaying strategies; human-gated live promotion (§3.10) |
| **Index + option-chain ingestion** | `layer-1-ingestion/` (+ FlatTrade py) | We ingest constituents; we must also ingest NIFTY/BANKNIFTY spot, India VIX, and the ATM±N option chain (LTP, bid/ask, OI, IV) — see §6 |
| **Layer 10 execution — finish + positional profile** | `layer-10-execution/src/**` | Scaffold exists; implement OMS/risk/strike/position-manager (FlatTrade-first), add a positional profile (ATR stop, overnight handling) |
| **Execution schema (TimescaleDB)** | `layer-3-storage/.../migrations/005_execution_schema.sql` | `trades`, `order_log`, `pnl_snapshots`, `option_chain_snapshots` hypertables |
| **Backtest harness (2-stage)** | `scripts/` + `layer-9-ai-service` | Signal backtest on index+breadth; option-leg backtest (BS model + cost layer); feeds the optimizer (§3.10) |
| **Breadth-based Predictive Model (L9)** | `layer-9-ai-service/app/**` + `shared/` | Expand `FeatureVector` (breadth+sectors+options+regime), build labeled dataset, train LSTM+baseline per regime, serve real inference; consumed by L6 as a confluence/sizing input (§3.11). **Currently scaffolded only — untrained dummy** |

---

## 5. System Architecture — How It Plugs Into the 9 Layers

```
                         ┌────────────────────────────────────────────────────────────┐
   BROKERS               │                     EVENT PIPELINE (Kafka)                   │
  (Kite / MStock /       │                                                              │
   FlatTrade)            │  raw-ticks → market_candles → analysis_updates →             │
        │                │                                sentiment_scores → trade-signals│
        ▼                │                                                              │
 ┌──────────────┐  ticks │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐  │
 │ L1 Ingestion │────────┼─▶│ L2       │──▶│ L4       │──▶│ L5       │──▶│ L6 Signal │  │
 │ • constituents│        │  │ Candles  │   │ Analysis │   │ Breadth+ │   │ (NEW:     │  │
 │ • index spot* │        │  └──────────┘   │ (Go)     │   │ Sectors  │   │  index    │  │
 │ • option chain*        │                 └──────────┘   │ (Go)     │   │  momentum)│  │
 │ • India VIX*  │        │                                └──────────┘   └─────┬─────┘  │
 └──────────────┘         │                                                     │        │
        │                 │        TradingView MCP (L1c) ── bias/regime ────────┤        │
        │                 └─────────────────────────────────────────────────────┼────────┘
        │                                                                        │ trade-signals
        │   ┌────────────────────────────────────────────────────────────┐      │ (profile: scalp|positional)
        │   │                    L10 EXECUTION                            │◀─────┘
        │   │                                                             │
        └──▶│  SCALP = HOT PATH: direct Kite WS → in-mem → risk → OMS      │───▶ Broker order
   (direct  │  POSITIONAL = COLD PATH: consume trade-signals from Kafka    │
    Kite WS │  Shared: risk manager, strike selector, position manager,    │
   for scalp)│  TRADE_MODE (paper→shadow→live), journal                    │───▶ TimescaleDB (trades)
            └──────────────────────────┬──────────────────────────────────┘───▶ Kafka execution-events
                                       │                                    ───▶ Redis (kill switch, positions)
                                       ▼
                            ┌──────────────────────┐
                            │ L8 Telegram / Dashboard│  alerts, /kill, daily P&L
                            └──────────────────────┘
   * = data we must add (see §6)
```

**One default path, one optional upgrade** (lag is acceptable — see §2.1):
- **All tiers (T1/T2/T3) default to the event pipeline:** on candle close, the Regime Engine updates
  `RegimeState`, the Strategy Router picks matching enabled strategies, Layer 6 emits `trade-signals`, and
  Layer 10 executes. Simple, uniform, fully backtestable.
- **Optional hot-path upgrade (T1 only):** the direct-WS, in-process, Kafka-bypass path in
  `OPTIONS_SCALPING_RULES.md` is added **only if** forward testing shows we're consistently late on the fastest
  1m bursts. In the diagram above it's the "SCALP = HOT PATH" branch — a later optimization, not a v1 requirement.
- **Order execution stays latency-hardened in every case:** FlatTrade-first, warm connection, broker-side resting
  SL-M, marketable-limit entry. Accepting *decision* lag never means leaving a position unprotected.

---

## 6. Data Requirements

| Data | Have? | Needed for | Action |
|---|---|---|---|
| NIFTY-50 constituent ticks/candles | ✅ | Breadth, sector momentum | — |
| Per-stock indicators + scores | ✅ | Breadth inputs | — |
| Breadth + sector metrics | ✅ | Regime gate | — |
| **NIFTY / BANKNIFTY spot ticks + candles** | ✅ | Entry trigger, ATR, VWAP | Added to shared instrument map + L1 ingestion config (tokens need user verification from MStock UI) |
| **Option chain (ATM±N): LTP, bid/ask, OI, IV, volume** | ✅ | Strike selection, liquidity gate, premium SL, IV filter | FlatTrade-based poller built (`layer-1-ingestion/src/vendors/option-chain-poller.js`); publishes to `option-chain` Kafka topic |
| **India VIX** | ✅ | Vol regime filter, sizing | Added to shared instrument map + normalizer (handles VIX as value, not price) |
| Option greeks (delta/theta) | ✅ derivable | Positional theta management | Computed via Black-Scholes in option-leg simulator (`scripts/backtest/option-simulator.js`) |
| **Historical option data** | ❌ (forward-recording) | Backtesting the option leg | **Built:** two-stage backtest harness (`scripts/backtest/`). Stage 1 = signal backtest on index + breadth history. Stage 2 = option-leg BS model with slippage/IV-crush cost layer. Forward-recorded snapshots harden the dataset over time |

> **Phase A status:** Data foundation is **built**. The remaining gap is MStock token verification (user action)
> and forward-accumulated historical option snapshots (time). Backtest harness can run on index data immediately.

---

## 7. Contracts — Kafka & DB Additions

### New / extended Kafka topics
| Topic | Producer | Consumer | Payload |
|---|---|---|---|
| `market-regime` (new) | Regime Engine (L5/L6) | L6 router, L7, L8 | `RegimeState` (§3.9): trend/strength/volatility/phase/tfAlignment/tradeableTiers |
| `trade-signals` (extend) | L6 | L10, L7, L8 | add `tier: T1\|T2\|T3`, `strategyId`, `regime`, `breadth_snapshot`, `strike_hint`, `reasons[]` |
| `execution-events` (new) | L10 | L7, L8, storage | fills, rejects, exits, P&L, feed-failover events (journal) |
| `option-chain` (new) | L1 | L4/L6/L10 | ATM±N snapshot (LTP, bid/ask, OI, IV) |

All schemas live in `shared/` (repo rule 3 — shared-tier dedup). Consumers must be idempotent (rule 4).

### TimescaleDB (migration `005_execution_schema.sql`)
- `trades` (hypertable): entry/exit, strike, expiry, profile, P&L, slippage, ordertag.
- `order_log` (hypertable): every OMS request/response with latency stamps.
- `pnl_snapshots` (hypertable): 30s snapshots during open positions.
- `option_chain_snapshots` (hypertable): forward-recorded chain for future backtesting.

CQRS respected (rule 5): Redis for live reads (kill switch, active positions, latest regime), TimescaleDB for writes.

---

## 8. Risk & Safety (never bypassed)

Reuse the Layer 10 risk manager for both profiles. The [`default.js`](../layer-10-execution/config/default.js)
values are the committed scalp baseline; the sizing below reflects the owner decision (2–3 lots initially):

- Max concurrent positions **1** (start), max trades/day **5**, max daily loss **₹2,500** → flips Redis kill switch.
- No new entries after **15:00**, forced square-off **15:15** (intraday/scalp).
- **Sizing: start 2–3 lots** (owner decision — overrides the config default of 1). Position size still capped by
  capital-at-risk ÷ premium-stop distance, rounded **down**; `maxLots` caps the hard ceiling. Scale beyond 3
  only after positive expectancy over 20–30 trades.
- Telegram **`/kill`** → `execution:kill_switch=1` halts all new entries instantly.

**Positional-specific additions:**

- **Overnight allowed (owner decision), long-premium only.** Carry overnight **only** if the regime is still
  valid at 15:15; **never sell/write options** to hold overnight (naked short-call/gap risk is off the table).
  Reduce size for overnight carries and apply a wider gap-aware stop.
- Separate daily-loss budget for positional vs scalp so one can't drain the other.

---

## 9. Speed — the OPTIONAL hot-path upgrade (T1 only)

Not required for v1 (lag is acceptable — §2.1). Build this **only if** forward testing shows the event-pipeline
T1 scalp is consistently late on the fastest 1m bursts. Fully specified in
[`OPTIONS_SCALPING_RULES.md`](OPTIONS_SCALPING_RULES.md). Levers, in order of payoff:
1. **TradingView is bias-only** — entry trigger computed in-process from direct Kite ticks (TV webhook is 2–5s, too slow).
2. **Hot path bypasses Kafka** — Kafka stays for journal/dashboard; entry decision is in-memory.
3. **Keep the broker connection warm** — `undici` persistent pool + 20s keep-alive (saves 100–300ms TLS/DNS).
4. **Deploy in Mumbai (`ap-south-1`)** — single-digit ms RTT vs 30–60ms from home broadband.
5. **Broker-side resting SL-M** from the fill moment; trail by *modifying* it (never cancel-replace → no naked window).
6. **Marketable limit + IOC** for entry — caps slippage vs MARKET.
7. Precompute strike map / payload template / auth token; no sync I/O on the tick path.

Realistic floor: **100–200 ms tick→fill**, dominated by the broker's match engine. The game is *consistency*
(no 2s outliers) and *slippage control*, not competing with HFT. Positional does not need any of this.

---

## 10. Implementation Phases — Build Status ✅

> **All phases A–E built 2026-07-09.** Ready for validation (Phase F).

```
Phase A — Data foundation (blocks everything)                          ✅ BUILT
  ├── Verify/add NIFTY & BANKNIFTY spot ingestion → market_candles     ✅ Index symbols in shared map (tokens need verification)
  ├── Add India VIX to ingestion                                       ✅ Added to shared map + normalizer
  ├── Build option-chain poller → option_chain_snapshots               ✅ FlatTrade-based poller, Kafka `option-chain` topic
  └── Confirm breadth (L5) is queryable in near-real-time (Redis)      ✅ Already published to `market_view:latest`

Phase B — Regime Engine (§3.9)                                         ✅ BUILT
  ├── Multi-TF classifier: trend/strength/volatility/phase/tfAlignment  ✅ `layer-6-signal/src/regime/` — ADX + EMA + ATR + VIX
  ├── Publish RegimeState → market-regime topic + Redis cache          ✅ Kafka + Redis pub/sub + KV
  └── Backtest regime labels against history                            🔜 Part of Phase F validation

Phase C — Adaptive Strategy Framework (§3.8)                           ✅ BUILT
  ├── Strategy plugin interface + registry + regime-affinity router    ✅ `layer-6-signal/src/strategies/`
  ├── First plugins: momentum-burst (§3.6) + trend-pullback            ✅ Both implemented with full entry/exit logic
  └── Emit trade-signals tagged tier + strategyId + regime + reasons[] ✅ Kafka `trade-signals` topic + Redis

Phase D — Backtest harness + Optimizer (§3.10)                         ✅ BUILT
  ├── Stage 1: signal backtest on index + breadth history              ✅ `scripts/backtest/backtest-runner.js`
  ├── Stage 2: option-leg backtest (BS model + cost layer)             ✅ `scripts/backtest/option-simulator.js`
  ├── Per-regime parameter optimization (walk-forward)                 ✅ `scripts/backtest/optimizer.js` — grid search
  └── Decay monitor + human-gated promotion workflow                   ✅ `decay-monitor.js` + `promotion-manager.js`

Phase E — Execution: Layer 10 (paper first, FlatTrade-first)           ✅ BUILT
  ├── OMS (FlatTrade + MStock), risk manager, strike selector          ✅ `layer-10-execution/src/` — all modules
  ├── TRADE_MODE=paper (simulated fills), full journaling              ✅ `paper-executor.js` + `trade-journal.js`
  ├── Migration 005 (trades, order_log, pnl_snapshots)                 ✅ `layer-3-storage/timescaledb/migrations/`
  └── Positional profile: overnight guard, breadth exit                ✅ Built into risk/position managers

Phase F — Validate → Shadow → Live (per §12)                           🔜 NEXT — validation scripts in `scripts/validation/`

Phase G (optional) — Hot-path upgrade for T1 (§9)                      ⏸️ Optional — build if Event Pipeline proves too slow
```

**Infra changes applied:** `execution` service added to `docker-compose.app.yml`; `market-regime`, `trade-signals`, `option-chain`, `execution-events` topics documented in `shared/TOPICS.md`; `.env.example` extended.

---

## 11. Owner Decisions — RESOLVED (2026-07-09)

| # | Decision | Answer | Design impact |
|---|---|---|---|
| 1 | Scalp tick source | **Both Zerodha (Kite) + FlatTrade** | Dual WS feed with failover — use whichever is lower-latency/healthy, fall back to the other on drop/staleness. See §11.1 |
| 2 | Primary execution broker | **FlatTrade** | OMS is FlatTrade-first (`NorenApiPy` adapter already exists); MStock stays as a secondary/optional executor |
| 3 | Positional overnight | **Allowed, long-premium only** | Carry overnight if regime valid; **never sell/write options** to hold. See §8 |
| 4 | Backtest ambition | **Full backtest (not signal-only)** | Two-stage harness: signal backtest on index+breadth, then option-leg backtest (BS model + cost layer, hardened by forward-recorded snapshots). See §6, §10 |
| 5 | Sizing | **2–3 lots initially** | `maxLots` baseline 2–3 (overrides config default 1), still capped by capital-at-risk sizing. See §8 |

### 11.1 Dual scalp feed (decision #1)

Run **two** tick sources for the scalp hot path and treat them as primary/backup:

- **Health/latency check per feed** — track last-tick age and tick-to-local latency; the feed with fresher,
  lower-latency ticks is "active".
- **Automatic failover** — if the active feed goes stale (> ~1–2s no tick) or disconnects, switch to the backup
  within one tick cycle. Log the switch to `execution-events`.
- **Divergence guard** — if the two feeds disagree on spot beyond a small tolerance, prefer the one consistent
  with the last candle and flag it; do not fire an entry on a lone outlier tick.
- Both feeds are **read-only for ticks**. Order execution is still **FlatTrade-first** (decision #2), independent
  of which feed sourced the trigger.

---

## 12. Validation Roadmap (must pass IN ORDER — no shortcuts)

1. **Signal backtest** (index data + breadth history): profit factor ≥ 1.3 after costs, expectancy ≥ +0.25R,
   ≥ 60 trades per profile per index.
2. **Paper** (`TRADE_MODE=paper`, min 2 weeks): full pipeline, simulated fills vs live LTP, journaled. Measure
   real slippage & how often the premium fallback stop fires vs the index stop.
3. **Shadow** (`TRADE_MODE=shadow`, 1–2 weeks): Telegram tells you what it *would* do; you fire manually; compare.
4. **Live, 1 lot** (`TRADE_MODE=live`): after SEBI algo registration + MStock/FlatTrade rate-limit confirmation.
   20–30 trades before any size increase.

---

## Decision Record

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-09 | Breadth-confirmed momentum is the core edge | Nifty-50 constituent data (already collected) confirms/denies index breakouts; kills fakeouts |
| 2026-07-09 | Positional uses the existing Kafka pipeline; only scalping needs the hot path | Positional latency is non-critical → reuse everything, avoid needless complexity |
| 2026-07-09 | Index-momentum signal generator lives in Layer 6 (not Layer 10) | Keeps signal logic in the signal layer; L10 stays execution-only; both profiles share it |
| 2026-07-09 | Reuse Layer 5 breadth/sector output as the regime gate | Already built and published on `sentiment_scores` |
| 2026-07-09 | Option chain is the primary new data pipeline; validate signal on index data first | Historical option data is hard to source retail; de-risk by proving the signal cheaply first |
| 2026-07-09 | Never sell options (long premium only), including overnight positional | Defined risk; avoids naked short-call/gap risk |
| 2026-07-09 | Scalp runs a dual tick feed: Zerodha (Kite) + FlatTrade with failover | Redundancy — a single feed dropping mid-scalp is unacceptable; use the healthier/lower-latency one |
| 2026-07-09 | FlatTrade is the primary execution broker; MStock secondary | Owner decision; FlatTrade `NorenApiPy` adapter already exists |
| 2026-07-09 | Positional overnight allowed if regime holds; long-premium only | Owner decision; carry only with edge intact, reduced size, gap-aware stop |
| 2026-07-09 | Full backtest harness (signal + option-leg), not signal-only | Owner decision; option-leg via BS model + cost layer, hardened by forward-recorded snapshots |
| 2026-07-09 | Initial sizing 2–3 lots (overrides config default of 1) | Owner decision; still capped by capital-at-risk sizing, scale after 20–30 trades |
| 2026-07-09 | Strategies are pluggable, never hardcoded (§3.8) | Owner: "there should be scope to change" — we don't assume the best strategy is known; add/swap/tune/retire without redeploy |
| 2026-07-09 | Build a first-class multi-TF Regime Engine (§3.9) | Owner: "understand the market moment on major timeframes" — regime gates tiers, routes strategies, enables positional |
| 2026-07-09 | Adaptation loop optimizes params per regime; live promotion is human-gated (§3.10) | Adapt to changing markets safely — auto-tune + auto-shadow, but never auto-change what trades real money |
| 2026-07-09 | Lag acceptable → all tiers default to the candle-close event pipeline; hot path is optional | Owner accepts lag; we capture 1m–multi-hour moves, not tick edges → simpler v1, hot path a later upgrade |
| 2026-07-11 | Add a breadth-based predictive model (L9) as a confluence input, **not** a trigger (§3.11) | Predict the index move from the 50 constituents + historical patterns to raise/lower conviction & sizing; never fires trades alone → stays explainable and fail-safe; must pass §12 validation before it influences live |

---

## Build Complete — What's Next

- **All design phases (A–E) are built.** Code written, files created, not git-pushed.
- **Phases F+G remain:** validation roadmap (§12) and optional hot-path upgrade.
- **Owner action items:**
  1. **Provide MStock index tokens** — Check MStock UI for NIFTY/BANKNIFTY/INDIAVIX tokens, update `vendor/nifty50_shared.json`.
  2. **Run `npm install`** in `layer-6-signal/`, `layer-10-execution/`, and `scripts/backtest/`.
  3. **Run validation** via `node scripts/validation/run.js backtest` to start Phase F.
  4. **Configure `.env`** — set broker credentials, TRADE_MODE (start with `paper`), and risk limits.
  5. **Review promotions** via `node scripts/backtest/run.js promote` after optimization runs.

### File Inventory (New/Modified)

| Area | Files | Phase |
|------|-------|-------|
| L1 Ingestion | Normalizer fix, index config, Kafka partition map, option-chain poller | A |
| L2 Processing | Candle aggregator (tick→1m OHLC), rewrite of index.js | A |
| L3 Storage | Migration 005 (trades, order_log, pnl_snapshots) | A |
| L5 Aggregation | Breadth filter (excludes NIFTY/BANKNIFTY/VIX) | A |
| L6 Signal | Regime Engine (Phase B), Strategy Framework + plugins (Phase C) | B, C |
| L10 Execution | Full execution engine (OMS, risk, position mgr, strike select, journal) | E |
| shared/ | `TOPICS.md` — new Kafka topic contracts | A |
| scripts/ | Backtest harness, optimizer, decay monitor, promotion manager, validation checkpoints | D, F |
| Infra | docker-compose updates for execution + signal services | A, B, E |
