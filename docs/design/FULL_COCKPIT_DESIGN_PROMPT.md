# Complete Application Design Prompt — "Stock Analysis By Gurus" Cockpit

> **How to use:** invoke the design skill **`/auto-trading-design`** (at `docs/design/Auto-Trading-v1/`), then
> paste the block under **"PROMPT (copy from here)"**. The skill already knows the brand tokens, the 15
> components, and the content rules; this brief specifies **every tab and every feature** of the complete app.
> Reference implementation (live click-through): the "cockpit-reference" artifact. Domain source of truth:
> [`MOMENTUM_TRADING_ARCHITECTURE.md`](../MOMENTUM_TRADING_ARCHITECTURE.md).

---

## PROMPT (copy from here)

Design the **complete operating application** for *Stock Analysis By Gurus* — a single-user NIFTY/BANKNIFTY
options **scalping + positional** trading terminal — using the **auto-trading-design** system. This is the full
spec: **17 primary tabs across 4 nav groups + 4 detail routes**, a global shell, all components, and all states.
Design **desktop-first** (the app's `CockpitTemplate` is a 3-column CSS grid) **and** a mobile layout
(bottom-tab, one scrolling page per tab, 430×932), in **both light and dark** themes. Deliver click-through HTML
per screen.

### A. Design laws — never break (from the design system)

1. **Tokens only** — every color/space/radius/shadow from CSS variables (`--color-*`, `--space-*`, `--radius-*`); **no raw Tailwind swatches**. Both themes via `[data-theme="dark"]`.
2. **Unknown = em-dash `—`**, never a confident `0` or blank. Stale data announces itself (`StaleBadge`).
3. **Color is never the only cue** — every P&L / risk / mode / stop signal states its meaning in words too.
4. **UPPERCASE only for hard state flags** — `PAPER`/`SHADOW`/`LIVE`, `HALTED`, `KILL`, `NO STOP`, `STALE`, `STAND ASIDE`. Everything else sentence case; short noun labels; operator voice; no marketing.
5. **Numbers over adjectives**; **₹ en-IN** grouping (`₹12,45,000`); **IST**; mono + `tabular-nums` for all prices, sizes, countdowns.
6. **Confirmations scale with danger** — halting = one confirm; *resuming* after a circuit-breaker trip = type a phrase.
7. **Reuse the 15 components**; design new organisms only where listed (section E), same idiom: slate surfaces, 1px `--color-border`, `rounded-xl` cards, lucide outline icons, **no colored left-border trope**, no shadow at rest except the sticky SafetyBar.

### B. Global shell (on every screen)

- **Sticky `SafetyBar`** (top): wordmark ("Stock Analysis By Gurus", primary→accent gradient — no logo file exists); NIFTY + BANKNIFTY spot + change (mono); India VIX; `TradeModeBadge` (PAPER/SHADOW/LIVE); IST clock; system-status dot; **theme toggle**; **`KillSwitchButton`** (`KILL` → `HALTED — Resume`). Reachable on every route (rules U1/U2).
- **Left sidebar** (desktop) / **bottom-tab bar** (mobile), grouped by verb, with active-route state, replacing today's 5 crammed gradient buttons.
- **Footer** keeps the human signature line.

### C. The tabs — exact count & what each keeps/does

**GROUP 1 · TRADE (3 tabs)**

1. **Scalp Cockpit** — `/scalp/[underlying]` *(keep, enhance)*. 3-column: (a) price chart with VWAP/EMA21 overlays + a "burst armed" banner; (b) live `OptionChainGrid` (ATM±3, CE LTP/OI | strike | OI/PE LTP, ATM highlighted); (c) **Engine Intent** card (strike, premium, delta, SL −18%, target +25–40%, "Arm entry" button) + a **confluence rail** (prediction %, breadth ✓, tier open). Underlying switcher NIFTY↔BANKNIFTY. *States:* engine online/offline, no-signal, order in-flight, halted.
2. **Positions & P&L** — `/positions` *(keep)*. `PositionsTable` (instrument, tier, entry, LTP, P&L%, stop — with **`NO STOP`** warning row); scalp vs positional visually separated; `DailyRiskCard` + `RiskMeter` (loss used / trades used); realized / unrealized / net split; per-position risk drawer; **NO STOP** banner. *States:* empty, halted.
3. **Orders & Execution** — `/orders` *(new)*. Order book: every request/response with status (placed/filled/rejected/cancelled), latency stamp, ordertag, strategy id; feed-failover events; broker used. Filter by status. Reuse `Table`. *States:* empty, reject detail.

**GROUP 2 · ANALYZE (6 tabs)**

4. **Overview** — `/` *(keep)*. Morning glance: 4 `StatTile`s (NIFTY, BANKNIFTY, India VIX, Day P&L vs limit); advance/decline meter; Regime summary chip; top movers by index-points; latest-signals strip. *States:* loading, stale, "market closed".
5. **Market Internals / Breadth** — `/internals` *(new)*. The "derive the index from its 50 stocks" screen: A/D meter (advancing/declining count + %), % above VWAP, % above EMA20, breadth-thrust sparkline; **SectorRotationStrip** (top-4 weighted sectors STRONG_UP…DOWN); **HeavyweightContributionList** (stock, weight, %move, index-points, leading/lagging). Answers "is this move real or fake?" at a glance.
6. **Regime** — `/regime` *(new)*. `RegimePanel`: trend (UP/DOWN/RANGE/REVERSING) + strength, volatility (LOW/NORMAL/HIGH), phase (TRENDING/CONSOLIDATING/BREAKOUT/EXHAUSTION), confidence; **tfAlignment** row (5m/15m/1h/Daily agree?); **tradeable tiers now** (T1/T2/T3 ENABLED / STAND ASIDE) with reasons.
7. **Predictions / AI** — `/ai` *(new)*. Breadth-based predictive model (§3.11): **PredictionGauge** (prob UP/DOWN/FLAT) + **ConfidenceMeter**; **horizon toggle** (Scalp 1–5m ↔ Positional); **FeatureContribution** bars (breadth, sector, heavyweight, PCR, VIX — signed); `model_version` + freshness; **explicit "model unavailable / abstains" state** (shows `—`, never a fake 0); framing "confluence input, not a trigger".
8. **Signals** — `/signals` *(new; today only a widget)*. Full feed + history of `trade-signals`: each a **SignalCard** (direction BUY CE/PE / NO TRADE, strategy id, tier, strike hint, `reasons[]` incl. prediction). Filter by All/Scalp/Positional/strategy/outcome. *States:* empty, no-trade-regime.
9. **Backtest Lab** — `/backtest` *(new)*. Run form (strategy, date range, capital, regime bucket) → results: **EquityCurveChart**, profit factor, expectancy (R), win-rate, max drawdown, trade list (`Table`), and the **human-gated promotion** state.

*(+ detail route)* **Symbol Analysis** — `/analysis/[symbol]` *(keep)*: per-stock deep dive — multi-timeframe indicator summary, candle patterns, PCR panel, chart. Linked from movers/breadth lists.

**GROUP 3 · CONFIGURE (4 tabs)**

10. **Strategies** — `/strategies` + `/strategies/[id]` *(extend)*. Registry of pluggable strategies (§3.8): **StrategyCard** (name, tier, regime-affinity, LIVE/SHADOW/RETIRED, win-rate, expectancy, profit factor, mini equity spark, enable/disable). Detail = per-regime parameters, full equity curve, link to backtest, decay status.
11. **Risk** — `/risk` *(extend)*. Envelope config: daily loss limit (→ kill switch) with live `RiskMeter`; max concurrent; trades/day; entry cutoff / square-off times; sizing (lots, capital-at-risk); **separate scalp vs positional loss budgets**; overnight-carry rules (positional).
12. **Brokers** — `/brokers` + `/brokers/[id]` *(keep)*. Provider registry (add/edit/enable/disable): per-broker connect state, role (primary exec / tick feed / secondary), mode PAPER/SHADOW/LIVE, latency, test-connection, masked credential form, re-auth (e.g. MStock TOKEN EXPIRED), dual-feed health.
13. **Settings** — `/settings` *(new)*. Theme selection (Midnight / Daylight / +High-contrast — tokens support >2); display prefs (₹ en-IN format, colorblind-safe P&L palette); notification prefs; session/account.

**GROUP 4 · OPERATE (4 tabs)**

14. **Backfill** — `/backfill` *(keep)*. Data-coverage grid (per symbol), backfill job form + progress bars, ETA. *States:* running, gaps, done.
15. **Swarm** — `/swarm` *(keep)*. Worker monitor: active workers, queue depth, throughput, error count, live log.
16. **System Health** — `/system` *(keep)*. Service board — each of L1–L10 up/down/lag with last-heartbeat; Kafka topic lag; DB/Redis status.
17. **Alerts / Notifications** — `/alerts` *(new)*. Center for Telegram + system alerts as **AlertItem** rows with severity (color **and** words) + IST timestamp: kill-switch trips, NO-STOP warnings, breadth-reversal exits, stale-feed / feed-failover, fills, rejects. Filter by severity; mark-read.

**Total: 17 primary tabs + 4 detail routes** (`/scalp/[underlying]`, `/strategies/[id]`, `/brokers/[id]`, `/analysis/[symbol]`).

### D. Modals / overlays (design these too)

Add Broker (credential form) · Backfill job · Arm/confirm entry (PAPER) · **Resume-after-halt** (type-a-phrase confirm) · Strategy tune · Position exit confirm. All use `Modal` (blurred backdrop, fade+scale 300ms).

### E. Components — reuse + new

**Reuse (15):** Button, Card (+Header/Body/Footer), Badge, Input, StatTile, RiskMeter, Table, Modal, KillSwitchButton, StaleBadge, TradeModeBadge, OptionChainGrid, SafetyBar, PositionsTable, DailyRiskCard.
**New organisms (design in the same idiom, tokens only, semantic-meaning-in-words, both themes, charts get area-fill + faint grid + emphasized endpoint):** `SidebarNav` (grouped, active state), `PredictionGauge`, `ConfidenceMeter`, `FeatureContributionBar`, `RegimePanel`, `TfAlignmentRow`, `SectorRotationStrip`, `HeavyweightContributionList`, `BreadthMeter` (A/D), `SignalCard`, `StrategyCard`, `EquityCurveChart`, `Sparkline`, `AlertItem`, `OrderRow`, `ConfluenceRail`, `EngineIntentCard`.

### F. States — design for every data surface

Loading (skeleton) · Fresh · **Stale** (`StaleBadge`) · Empty · Error / "engine offline" · **Halted / Kill** · Unknown value (`—`). Halted and Stale are **safety states**, not edge cases — show them explicitly.

### G. Data → screen mapping (so panels reflect real backend)

Breadth/sectors ← L5 (`breadth.go`, `aggregator.go`, Redis `market_view:latest`). Regime ← L6 `market-regime` topic. Signals ← `trade-signals`. Prediction ← L9 `/predict` (`FeatureVector`→`PredictionResult`). Option chain ← `option-chain` topic. Positions/orders/P&L ← L10 + `execution-events`. Risk ← `layer-10-execution/config/default.js`. Alerts ← L8 notification layer.

### H. Deliverable & priority

Per screen: a mobile artifact (430×932) **and** a desktop artifact, both themes via a toggle. **Build order:** first the 5 new screens (Market Internals, Regime, Predictions, Signals, Alerts) — no design exists for them; then Scalp/Positions/Overview refined; then Configure/Operate. **Confirm this 17-tab list and the build order with me before producing all screens.**

## (end of prompt)
