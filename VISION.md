# VISION — What This System Is For

> **Canonical.** This file and [`ARCHITECTURE.md`](ARCHITECTURE.md) are the two source-of-truth
> documents. If any other doc, comment, or tool disagrees with these two, these two win.
> Everything under `docs/` is now either a dated decision record or has been deleted.

---

## 1. The one-sentence purpose

**Learn how NIFTY, BANKNIFTY, and the NIFTY-50 constituents have behaved across five years of
multi-timeframe history, recognise when the market is repeating a shape it has printed before, and
use that to take scalping and positional options trades — validated offline before a rupee is
risked.**

Two distinct jobs live inside that sentence, and the architecture keeps them physically separate:

1. **Research** — mine history, find analog patterns, measure what happened next, validate strategies.
   Batch, offline, reproducible. This is where the "intelligence" lives.
2. **Trading** — run the validated strategies live on the streaming market and execute options orders
   with hard risk controls. Real-time, low-latency, fail-closed.

A strategy is *discovered* in the Research plane and only *deployed* to the Trading plane after it
survives backtesting. They share data, never a code path.

---

## 2. What the system must be able to do

**Data**
- Ingest live index + constituent ticks and the option chain (LTP, bid/ask, OI + OI-change, IV, greeks).
- Persist **five years** of 1-minute candles and derive 5m/15m/30m/1h/1d/weekly views from them.
- Pull advisory alternative data (India VIX, FII/DII, PCR, max-pain, global cues) — never as a hard trigger.

**Research (the reason the project exists)**
- **k-NN analog matching**: normalise the last N bars into a shape vector, find the most similar windows
  in history, and report the empirical distribution of what happened next — a probability, not a guess.
- Multi-timeframe regime classification (trend / volatility / phase across 5m→Daily).
- Options analytics: IV rank/percentile, OI-buildup classification, PCR, max-pain, greeks.
- Backtesting + optimisation, **point-in-time correct** (no survivorship bias, no look-ahead).

**Trading**
- Signal generation from the deployed, regime-routed strategies.
- Options execution: strike selection, entry+resting-SL atomicity, trailing/target/time exits, expiry roll.
- Risk: per-trade and daily limits, a persisted kill switch, `paper → shadow → live` with `live` fail-closed.

**Control (all from the dashboard, no redeploy)**
- Add/edit/enable/disable/prioritise any broker or data provider.
- Enable/disable/tune strategies per regime; set risk limits; flip the kill switch.
- Broker auth: the user supplies credentials from the dashboard; the backend logs in **once** and stores
  the session token centrally; internal services read that token and never log in themselves.

---

## 3. What "identify the old pattern" means here

The chosen method is **k-nearest-neighbour analog matching** (decided 2026-07-10):

1. Take the recent price window (per symbol, per timeframe) and normalise it into a shape vector
   (z-scored returns, so 2019 and 2026 are comparable regardless of absolute price).
2. Find the *k* most similar historical windows across five years.
3. Look at what actually happened in the bars *after* each of those analogs.
4. Report the **empirical distribution** — "in the 40 closest historical analogs to right now, price was
   higher 1 hour later 68% of the time, median +0.4%, worst case −1.1%."

This is deliberately explainable and needs no training. It produces a probability with a spread, which
the strategy layer turns into a sized trade or a stand-aside. Regime clustering and classical chart
patterns are complementary inputs, not the core.

---

## 4. Non-negotiable properties

| Property | What it means here |
|----------|--------------------|
| **Point-in-time correctness** | Every historical query uses the world as it was on that date. Index membership comes from `index_members_asof(index, date)` — never today's constituents applied to the past. No look-ahead in features. |
| **Synthetic is labelled** | Backtest option P&L is Black-Scholes at constant IV — a *ranking*, not a forecast. Every such value is stamped `synthetic: true`. A model number is never shown as a real fill. |
| **Fail closed** | A capability that can't be provided refuses to construct. `live` needs `LIVE_TRADING_ARMED=true` + a broker that can place a resting stop and confirm fills. Unknown data is an em-dash/null/throw, never 0. |
| **One source of truth** | Any constant/type/topic/key used in more than one place lives in exactly one place (`shared/`). Enforced by the constants-parity and no-ts/js-twin gates. |
| **Verify by execution** | "It works" means a test drove the real function and observed the behaviour — not that a status file said so. |

---

## 5. What is real today (2026-07-10)

Honest status. See [`.ai/handoffs/`](.ai/handoffs/) for the running log.

- **Runs and is tested:** L1 ingestion, L2 candle build, L6 regime indicators, L10 execution
  (91 invariant assertions), L7 broker auth (70/78), the shared module, migration 007, the backtest
  harness's synthetic pricing. All of these crashed on `MODULE_NOT_FOUND` at the start of the
  2026-07-10 recovery session; they were restored and are green.
- **Designed, not yet built:** the k-NN analog engine, the historical backfill service + the API
  modules the dashboard already calls (`/api/v1/data/*`, `/api/v1/system/backfill/*`), the
  `index_membership` loader (the table ships empty on purpose).
- **Not live:** `LIVE_TRADING_ARMED` is unset. Live execution has never placed a real order and must
  not until the validation roadmap in `ARCHITECTURE.md` §Trading is complete.

---

## 6. Where the detail lives

- **How it's built** → [`ARCHITECTURE.md`](ARCHITECTURE.md) (the three planes).
- **The rules every tool must follow** → [`CLAUDE.md`](CLAUDE.md).
- **Durable decisions** → `.ai/MEMORY.md`. **Running work log** → `.ai/handoffs/` and `CHANGELOG.md`.
- **Schema** → [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md).
