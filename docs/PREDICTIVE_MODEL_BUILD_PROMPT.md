# Build Prompt — Breadth-Based Predictive Model for NIFTY / BANKNIFTY (Layer 9)

> **How to use this file:** paste the section under **"PROMPT (copy from here)"** into a fresh Claude Code
> session at the repo root. It is written to be self-contained and grounded in the *actual* current state of the
> code (verified 2026-07-11), so the agent does not have to re-discover it. Companion design: §3.11 of
> [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md).

---

## PROMPT (copy from here)

You are extending the **Trading-System** monorepo. Read `CLAUDE.md`, `.ai/MEMORY.md`, and
`docs/MOMENTUM_TRADING_ARCHITECTURE.md` §3.11 first, and obey the project contract (graphify-first for all
codebase search; run `graphify update .` after edits; shared-tier dedup; event-driven Kafka; CQRS; fail-closed;
never fabricate a value; verify by execution; Python for Layer 9, no secrets in code).

### Goal

Build a **breadth-based predictive model** that forecasts the next **NIFTY / BANKNIFTY** index move from
(a) the live movement of its **50 constituent stocks** (breadth, sector rotation, heavyweight contribution) and
(b) **historical patterns** (analog forecasting / sequence modelling). It must serve **two horizons**: a *scalp
head* (next 1–5 min) and a *positional head* (next N hours–sessions). The output is a **confluence / sizing
input** consumed by Layer 6 — **it never fires a trade on its own.**

### Ground truth — what exists TODAY (do not re-scaffold these; extend them)

- `layer-9-ai-service/app/main.py` — FastAPI. `POST /predict` takes `PredictionRequest {symbol, features: List[FeatureVector]}` → `PredictionResponse {prediction, confidence, reasoning, model_version, ...}`. Prometheus metrics + structured JSON logging already wired. `POST /backtest` exists (`BacktestEngine`).
- `layer-9-ai-service/app/core/engine.py` — `FeatureVector` currently has **only 6 fields**: `rsi, macd, ema50, ema200, close, volume`. `PredictionResult`. `BaseEngine.predict(symbol, features)` ABC. Engines: `PyTorchEngine`, `OllamaEngine`, `OpenAIEngine`, `ClaudeEngine`, `HeuristicEngine`, selected by `AI_PROVIDER`.
- `layer-9-ai-service/app/engines/pytorch_engine.py` — `LSTMModel(input_size=14, ...)` but FeatureVector supplies 6 (**mismatch**); `PyTorchEngine.predict` returns a hardcoded `0.65` dummy and **loads no weights** (`v1.0.0-lstm-untrained`).
- **Upstream data already produced:** breadth (`layer-5-aggregation/internal/breadth/breadth.go` — A/D, %aboveVWAP, %aboveEMA20) and sector momentum (`.../aggregator/aggregator.go`), published to Redis `market_view:latest` and Kafka `sentiment_scores`. Regime (`RegimeState`) on the `market-regime` topic (L6). Option chain on the `option-chain` topic. India VIX ingested (L1). Candle/breadth/option history in TimescaleDB (L3, migration 005 area).

**So the model is scaffolded but non-functional: single-symbol, technical-only features, untrained dummy output, not consumed anywhere.** Your job is to make it real.

### What to build — phased, each phase independently verifiable

**Phase 0 — Prove the edge cheaply, before any ML (do this first; gate everything else on it).**
- A **daily-bar breadth study** on **point-in-time NIFTY-50 constituents + historical free-float weights**
  (membership rotates ~every 6 months, ~20+ names over 10y → today's 50 against old index data is
  survivorship-biased fiction). Compute 4–5 breadth features (A/D ratio, % above 20/50-DMA, up-vol vs down-vol,
  contribution concentration/HHI, sector breadth) and test one rule — *fade narrow 1% index moves, follow broad
  ones* — over ~10 years, **net of realistic option round-trip cost** (STT + bid-ask + slippage + theta), with
  **walk-forward** validation (never a single random split).
- **Decision gate:** build Phases 1–6 **only if** a small, stable, post-cost edge survives. Expect positional
  (days–weeks) to work before scalp — breadth is *contemporaneous*, so the edge lives in index-vs-internals
  **divergences** (~52–55% hit rate, regime-dependent), not a crystal ball.
- Deliverable: `scripts/research/breadth-study.py` (or `layer-9-ai-service/app/research/`) + a short findings
  note. Throwaway-quality research code whose job is to kill or confirm the idea before you invest in ML.

**Phase 1 — Feature contract (shared source of truth).**
- Define the expanded feature schema **once** in `shared/` (per contract rule 3/14) and consume it from L9; do not redeclare per-layer. Fields: index OHLCV + RSI/MACD/EMA/VWAP/ATR on 5m/15m/1h; breadth (A/D, %aboveVWAP, %aboveEMA20, breadth-thrust Δ); top-4 weighted sector states; index-points contribution of the top ~10 constituents; PCR + ChgOI at ATM±N + IV; India VIX; ATR percentile; `RegimeState` fields; `tfAlignment`.
- Model input is a **sequence window** of the last *N* candles of these features. Fix `LSTMModel.input_size` to equal the real per-timestep feature count (no more 14-vs-6 mismatch).
- Update `FeatureVector` (or add a `FeatureFrame`/window type) accordingly. Version the schema.

**Phase 2 — Dataset + labels (offline).**
- Build a dataset builder (Python, `layer-9-ai-service/app/data/` or `scripts/`) that reads historical candles + breadth history + option-chain snapshots from TimescaleDB and emits `(feature_window, label)` rows. **Breadth features MUST use point-in-time constituent membership + historical weights** (not today's list) — carry a `constituents_asof` join, or the dataset is survivorship-biased.
- Label = forward index return over each horizon, bucketed **UP / DOWN / FLAT** (thresholds configurable), with an optional continuous magnitude target. **Strict no-lookahead**; IST session boundaries and weekly-expiry handling respected. Persist train/val/test splits by **time** (never random — this is a time series).

**Phase 3 — Training (offline, per regime).**
- **Prefer gradient boosting (XGBoost / LightGBM) on the breadth + regime features first** — for tabular breadth signals it usually beats an LSTM and is far easier to validate/explain. Train an LSTM **only if** it demonstrably beats the boosted baseline on walk-forward holdout (sequence structure must earn its keep). **Walk-forward** validation; optimize/evaluate **per regime bucket** (align with §3.10). Fit and persist a feature scaler. *(Later technique ladder, in order of practicality: lead-lag heavyweight/futures modelling → HMM regime-switching → options-market-derived signals — add only after the boosted baseline shows a post-cost edge.)*
- Save versioned artifacts: `model.pth` (or per-head), scaler, and a **feature manifest** (ordered feature names + version) so serving can validate the contract.
- Report both ML metrics (accuracy, AUC, calibration) **and** a trading-expectancy proxy on the holdout. A model that is accurate but not expectancy-positive is a fail.

**Phase 4 — Serving (make `/predict` real, fail-closed).**
- Implement real `PyTorchEngine.predict`: load weights + scaler + manifest; validate incoming features against the manifest; transform; run inference; return calibrated prob(UP/DOWN/FLAT) + expected magnitude + confidence + `horizon` + top-feature `reasoning`.
- **Fail-closed (rule 11) / never fabricate (rule 13):** if the model file is missing, the feature contract mismatches, or required features are absent/stale, **abstain** — return an explicit "no-prediction" result (not `0`, not a guess). Distinguish "model unavailable" from "model says FLAT".
- Add a `horizon` param to the request. Keep the existing metrics/logging. Note the scalp-head latency budget.

**Phase 5 — Integrate into Layer 6 (consume the score).**
- L6 fetches the prediction (HTTP `/predict`, or a `predictions` Kafka topic if you prefer async — put any new topic/schema in `shared/`, keep consumers idempotent).
- Use it as a **confluence + sizing input** to the momentum-burst strategy (§3.6) and a **tier-confidence** input to the regime engine (§3.9). It adjusts conviction/lots; it is **never** the sole entry trigger. Tag the contribution in `trade-signals.reasons[]`. Surface the live score in the dashboard `AIPredictionPanel`.

**Phase 6 — Validate before it counts.**
- The prediction may influence **paper/shadow** immediately but must **beat the baseline and show positive expectancy** (per §12) before it is allowed to affect **live** sizing. Promotion to live is **human-gated** (§3.10). Wire it to the decay monitor so a degrading model auto-demotes.

### Constraints (hard)

- **shared/** is the single source of truth for the feature schema, any new Kafka topic, and any constant/enum. No per-layer redeclaration.
- **Event-driven + idempotent** if you add a topic; **CQRS** (Redis reads / TimescaleDB writes) if you touch storage.
- **Fail-closed, never fabricate** — an absent/degraded input abstains or errors; it is never coerced to 0/FLAT.
- **Verify by execution** — add tests: feature-contract parity, no-lookahead in the label builder, serving abstains on missing model, `input_size` matches manifest length. State clearly when a test vs the code is wrong.
- **Python/L9 conventions**; no secrets in code (env only); no `.env` committed.
- **PR workflow** — feature branch, conventional commits, do not push to `main`; leave work staged unless told otherwise. Run `graphify update .` after edits.

### Acceptance criteria (Definition of Done)

1. `FeatureVector`/feature schema lives in `shared/`, includes breadth+sector+options+regime, and `LSTMModel.input_size` equals the manifest length (a test asserts this).
2. A dataset builder produces time-split `(window, label)` datasets from real L3 history, with a no-lookahead test.
3. Training produces versioned `model.pth` + scaler + manifest, and a report comparing LSTM vs baseline on ML **and** expectancy metrics.
4. `POST /predict` returns a real, calibrated prediction with `horizon` + `reasons`, and **abstains** (verifiable test) when the model or features are missing.
5. L6 consumes the score as a sizing/confluence input, tags it in `reasons[]`, and it appears in `AIPredictionPanel` — with a test proving it can never be the sole trigger.
6. Docs updated: flip §3.11 status rows as pieces land; add a CHANGELOG entry.

### Do NOT

- Do **not** let the model output trigger a trade by itself, or size beyond the risk caps in `layer-10-execution/config/default.js`.
- Do **not** auto-promote a model to live — human sign-off only.
- Do **not** emit a fabricated/`0` prediction on missing data — abstain.
- Do **not** create `x.ts`/`x.js` twins or bypass the graphify-first / shared-tier rules.
- Do **not** train on randomly-shuffled splits (lookahead leakage) — split by time.
- Do **not** compute breadth from today's constituent list against historical data (**survivorship bias**) — use point-in-time membership + weights.
- Do **not** report a backtest edge gross of costs — STT/bid-ask/slippage/theta can erase a modest directional edge; always net it out.
- Do **not** skip Phase 0 and jump to an LSTM — a beautiful backtest on biased data that dies live is the default failure mode here.

### First step

Run `graphify explain "FeatureVector"` and `graphify explain "PyTorchEngine"`, read the three L9 files above and the L5 breadth/aggregator files, then **run Phase 0 first** — the daily breadth study on point-in-time constituents, net of costs, walk-forward. Report whether a post-cost edge exists. Only if it does, propose the concrete `shared/` feature schema + `LSTMModel.input_size`, confirm it with me, and build Phase 1.

## (end of prompt)
