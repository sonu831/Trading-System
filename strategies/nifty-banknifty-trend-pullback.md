# NIFTY / BANKNIFTY Intraday Options Signal Strategy

**Name:** Trend-Pullback Continuation (15m filter / 10m trigger)
**Instruments:** NSE:NIFTY, NSE:BANKNIFTY (signals on index spot; execution via ATM weekly options on a separate broker portal, manually)
**Status:** PLAN — not yet validated. Do not trade this until Phase 1 & 2 below pass.
**Created:** 2026-07-04

---

## 1. Idea

Intraday index trends on NIFTY/BANKNIFTY tend to continue after shallow pullbacks. We only trade
in the direction of the 15-minute trend, and we enter on a 10-minute pullback-resumption trigger.
Direction long → buy ATM CE. Direction short → buy ATM PE. Never sell options.

The rules below are deliberately mechanical — every condition is computable from OHLCV bars so the
signal engine (and a Pine backtest) can check them without judgment.

## 2. Indicators

Computed on index spot chart:

| Timeframe | Indicators |
|-----------|-----------|
| 15m | EMA-21, EMA-50, session VWAP, RSI-14 |
| 10m | EMA-21, RSI-14, ATR-14, prior-candle high/low, 3-candle swing low/high |

All conditions are evaluated **on closed candles only** (no intra-candle signals).

## 3. Session & time filters (IST)

- Market session: 09:15–15:30
- **No entries before 09:45** (let opening volatility settle)
- **No new entries after 14:30**
- **Hard exit all positions by 15:15**
- Skip known event days entirely: RBI policy, Union Budget, election results, Fed decision nights
  followed by gap days (manual judgment — the engine flags, human decides)

## 4. Entry rules

### Long → BUY ATM CE (all must be true at a 10m candle close)

1. **Time window:** 09:45–14:30 IST
2. **15m trend up** (on last closed 15m candle): EMA-21 > EMA-50 AND close > EMA-21 AND close > VWAP
3. **Pullback happened:** within the last 5 closed 10m candles, at least one candle's low ≤ its 10m EMA-21
4. **Resumption trigger:** current 10m candle closes above the prior 10m candle's high AND above its own EMA-21
5. **Momentum:** 10m RSI-14 > 52
6. **Volatility floor:** 10m ATR-14 ≥ 0.05% of index price (NIFTY ≈ 12 pts, BANKNIFTY ≈ 29 pts) — skip dead chop

### Short → BUY ATM PE (exact mirror)

1. Time window: 09:45–14:30 IST
2. 15m trend down: EMA-21 < EMA-50 AND close < EMA-21 AND close < VWAP
3. Within last 5 closed 10m candles, at least one candle's high ≥ its 10m EMA-21
4. Current 10m candle closes below prior candle's low AND below its EMA-21
5. 10m RSI-14 < 48
6. Same ATR floor

## 5. Exits (managed on the INDEX level, executed on the option)

- **Stop-loss:** lowest low of the last 3 closed 10m candles (for longs; mirror for shorts),
  minus a 0.1 × ATR buffer
- **Target:** entry ± 2 × risk (2R — matches `rules.json` riskRewardMinimum)
- **Break-even trail:** once price moves +1R in your favor, move stop to entry
- **Time exit:** close everything at 15:15 regardless of P&L
- **Premium fallback stop:** if the option premium drops **−35% from entry**, exit even if the
  index stop hasn't hit (protects against IV crush / slow drift where premium bleeds faster than the index moves)

## 6. Options mapping

- **Strike:** ATM — index rounded to nearest 50 (NIFTY) / 100 (BANKNIFTY)
- **Expiry:** nearest weekly with **≥ 2 trading days left**; otherwise roll to next weekly
  (avoids expiry-day gamma/theta chaos)
- **Order type on portal:** limit at/near ask; if not filled within 1 minute, reassess — the signal
  assumed entry at the trigger candle close, and a 10m system tolerates ~1–2 min of manual latency
  but not more

## 7. Risk & discipline limits (inherits rules.json riskRules)

- Risk per trade: **max 2% of capital** (position size = 2% ÷ premium-stop distance × lot size, rounded DOWN)
- **Max 2 signals per index per day**
- **Stop for the day after 2 consecutive losses** (across both indices)
- Never average down; never re-enter the same signal after a stop-out
- One position per index at a time

## 8. Signal engine (implementation spec — Phase 3)

`scripts/signal-engine.mjs` (to be built after validation passes):

- Runs during market hours via scheduled task; wakes at each 10m candle close (09:25, 09:35, …)
- Pulls last ~120 bars of 10m and 15m via the repo CLI (same pattern as `scripts/12hr-snapshot.ps1`)
- Evaluates the rules above; parameters read from `rules.json → intradayStrategy`
- Emits to `~/.tradingview-mcp/signals/YYYY-MM-DD.jsonl`, one JSON line per evaluation:
  `{time, symbol, signal: "BUY_CE"|"BUY_PE"|"EXIT"|"NONE", entry, stop, target, strike, expiry, reasons[]}`
- Desktop toast notification on actionable signals
- **The engine never places orders.** Execution is always manual on the separate portal.

## 9. Validation roadmap — must pass IN ORDER before real money

### Phase 1 — Pine backtest (1–2 sessions of work)
Implement the rules as a Pine v6 strategy (10m chart, 15m data via `request.security`), run in
TradingView Strategy Tester on maximum available 10m history for both indices.
Model costs: 0.05% slippage+costs per round trip.

**Pass criteria (each index separately):**
- Profit factor ≥ 1.3 after costs
- Expectancy ≥ +0.25R per trade
- Max drawdown ≤ 2× the largest winning month
- ≥ 60 trades in the sample (otherwise not statistically meaningful)

### Phase 2 — Paper signals (2–4 weeks)
Run the signal engine live in log-only mode. Each evening compare: Were signals actionable within
2 minutes? Did the premium fallback stop fire more often than the index stop? Does live expectancy
roughly match backtest?

**Pass criteria:** ≥ 20 paper signals, live expectancy within 30% of backtest, no systematic
execution-lag problem.

### Phase 3 — Live, minimum size (4 weeks)
1 lot only, strict limits from §7. Review weekly. Scale only after a profitable month with
discipline intact.

## 10. Known weaknesses (be honest with yourself)

- Trend-pullback loses money in tight range days — the ATR floor and VWAP filter reduce but don't
  eliminate this
- Buying options means theta works against you; the 2R target must hit reasonably fast — expect
  many small premium-stop losses on stall days
- Backtest on index spot ignores option-specific slippage, IV spikes at entry, and strike liquidity
- Manual execution lag of 1–2 min is modeled crudely (slippage assumption), not exactly

---

*This is a research plan, not financial advice. Nothing here guarantees profitability; the phased
validation exists precisely because most intraday ideas fail Phase 1.*
