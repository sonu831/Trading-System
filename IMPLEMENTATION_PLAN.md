# Comprehensive Stock Analysis Dashboard — Implementation Plan

## Goal
Transform the `/analysis/[symbol]` page into a full-featured, multi-factor, multi-timeframe stock analysis dashboard with 8+ technical indicators, candlestick pattern detection, volume analysis, options PCR, historical backtesting, and AI-powered predictions.

---

## What Already Exists

### Frontend (`stock-analysis-portal`)
- Symbol page with candlestick chart (lightweight-charts v5), EMA overlays (20/50/200)
- RSI and MACD indicator panels
- Basic multi-timeframe summary (RSI + trend for 15m, 1h, 1d)
- Timeframe selector (1m → 1w)
- `useAnalysis` hook fetching 3 separate endpoints

### Layer 7 API (`AnalysisService.js`)
- Calculates RSI(14), MACD(12,26,9), EMA(20,50,200) using `technicalindicators` library
- Score-based signal badge (Buy/Sell/Neutral)
- Endpoints: `/api/market/candles`, `/api/market/overview/:symbol`, `/api/market/multi-tf/:symbol`

### Layer 9 AI Service
- `POST /predict` — accepts FeatureVector {rsi, macd, ema50, ema200, close, volume}
- `POST /analyze_market` — market sentiment
- Engines: Heuristic, Ollama (functional), OpenAI/Claude (placeholders), PyTorch (untrained)

### Database (TimescaleDB)
- `candles_1m` hypertable + continuous aggregates: 5m, 10m, 15m, 30m, 1h, 1d, weekly
- `options_chain` table with greeks (strike, OI, volume, IV, delta, gamma, theta, vega)
- `technical_indicators` table (cached per symbol/timeframe)
- `signals` table with multi-factor scores
- 10 years of historical data

---

## Bug Fix (Pre-requisite)

| File | Line | Bug | Fix |
|------|------|-----|-----|
| `layer-7-core-interface/api/src/modules/analysis/AnalysisRepository.js` | 29 | `'1w': 'candles_1w'` — migration `003` creates `candles_weekly` not `candles_1w` | Change to `'1w': 'candles_weekly'` |

---

## Phase 1: Backend — Enhanced Analysis Service

### 1A. New Repository Methods
**File**: `layer-7-core-interface/api/src/modules/analysis/AnalysisRepository.js`

#### `getOptionsChain(symbol)`
```sql
SELECT strike, option_type, ltp, open_interest, volume, iv
FROM options_chain
WHERE symbol = $1
  AND expiry = (SELECT MIN(expiry) FROM options_chain WHERE symbol = $1 AND expiry >= CURRENT_DATE AND time > NOW() - INTERVAL '2 days')
  AND time = (SELECT MAX(time) FROM options_chain WHERE symbol = $1 AND expiry >= CURRENT_DATE)
ORDER BY strike ASC, option_type ASC
```

#### `hasOptionsData(symbol)`
```sql
SELECT 1 FROM options_chain WHERE symbol = $1 AND time > NOW() - INTERVAL '7 days' LIMIT 1
```

#### Enhance existing `getMultiTimeframeCandles()`
- Currently: `['15m', '1h', '1d']`
- Change to: `['5m', '15m', '1h', '4h', '1d', '1w']`

---

### 1B. New Indicator Calculation Methods
**File**: `layer-7-core-interface/api/src/modules/analysis/AnalysisService.js`

**New imports** (add to existing `RSI, MACD, EMA`):
```js
const { RSI, MACD, EMA, SMA, BollingerBands, ATR, ADX, Stochastic, OBV, bullish, bearish } = require('technicalindicators');
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `calculateBollingerBands` | `(closes, period=20, stdDev=2)` | Returns `{upper[], middle[], lower[]}` |
| `calculateATR` | `(highs, lows, closes, period=14)` | Average True Range for volatility |
| `calculateSupertrend` | `(highs, lows, closes, period=10, multiplier=3)` | Manual implementation (not in library). Uses ATR internally. Returns `[{value, direction}]` where direction: `1`=Bullish, `-1`=Bearish. Logic mirrors Go Layer 4 code. |
| `detectCandlePatterns` | `(candles)` | Uses `bullish.*` / `bearish.*` from technicalindicators. Detects: Hammer, Engulfing, Harami, MorningStar, EveningStar, ThreeWhiteSoldiers, ThreeBlackCrows, ShootingStar, Doji. Returns `[{index, time, patterns: [{name, type}]}]` |
| `calculatePCR` | `(optionsData)` | Computes from options chain. Returns `{pcr, putOI, callOI, pcrVolume, putVolume, callVolume, maxPainStrike}` |
| `computeVerdict` | `(rsi, macdHist, emas, close, supertrend, bb)` | **Multi-factor scoring** — 5 factors, ±2 points each (max ±10). Returns `{signal, confidence, score, factors}` |

#### `computeVerdict` — Scoring Logic

| Factor | Weight | Bullish | Bearish |
|--------|--------|---------|---------|
| RSI | ±2 | <30 Oversold (+2), <40 Weak (+1) | >70 Overbought (-2), >60 Strong (-1) |
| MACD Histogram | ±2 | Positive (+2) | Negative (-2) |
| EMA Alignment | ±2 | Close > EMA20 > EMA50 > EMA200 (+2) | Close < EMA20 < EMA50 < EMA200 (-2) |
| Supertrend | ±2 | Direction = 1 (+2) | Direction = -1 (-2) |
| Bollinger Position | ±2 | Near lower band <20% (+2) | Near upper band >80% (-2) |

- Score normalized to -1..+1
- `> 0.3` → Bullish, `< -0.3` → Bearish, else Neutral
- Confidence = `|normalizedScore| * 100`

---

### 1C. New Composite Service Methods

#### `getCandlesWithFullIndicators(symbol, interval, limit)`
Enhanced version of existing `getCandlesWithIndicators`. Returns:
```js
{
  candles: [...],
  indicators: {
    rsi: [...],          // existing
    macd: { macd, signal, histogram },  // existing
    ema: { ema20, ema50, ema200 },      // existing
    bollingerBands: { upper, middle, lower },  // NEW
    atr: [...],                                // NEW
    supertrend: [{value, direction}, ...],     // NEW
    volume: { raw: [...], avg20: [...] },      // NEW
    candlePatterns: [{index, time, patterns}], // NEW
  },
  summary: { latestRSI, trendState, signalBadge }
}
```

#### `getEnhancedMultiTimeframeSummary(symbol)`
For each of 6 timeframes (5m, 15m, 1h, 4h, 1d, 1w) — fetched in parallel:
```js
{
  '5m': {
    available: true,
    rsi: 38.5,
    macdHistogram: 1.2,
    ema20: 2454, ema50: 2448, ema200: 2390,
    bollingerBands: { upper, middle, lower },
    atr: 12.5,
    supertrend: { value: 2440, direction: 1 },
    close: 2455.3,
    verdict: {
      signal: 'Bullish',
      confidence: 70,
      score: 7,
      factors: { rsi: 'Neutral', macd: 'Bullish Momentum', ema: 'Bullish Alignment', supertrend: 'Bullish', bb: 'Mid-Band' }
    }
  },
  '15m': { ... }, '1h': { ... }, '4h': { ... }, '1d': { ... }, '1w': { ... }
}
```

#### `getOptionsAnalysis(symbol)`
- Checks `hasOptionsData()` first — returns `null` gracefully if no options data
- If data exists, fetches chain and calls `calculatePCR()`

#### `getAIPrediction(symbol)`
1. Fetch 200 candles at 15m interval
2. Calculate RSI, MACD, EMAs to build FeatureVector
3. Call Layer 9 `POST /predict` with `{symbol, features: [{rsi, macd, ema50, ema200, close, volume}]}`
4. Return `{prediction, confidence, reasoning, modelVersion}`
5. Graceful fallback if AI service unavailable

#### `runBacktest(symbol, indicator, operator, threshold, thresholdHigh)`
Historical pattern backtesting:
1. Load 2500 daily candles (≈10 years)
2. Calculate indicator series in JS (RSI or MACD histogram)
3. Find all dates where condition matches (e.g., RSI < 30)
4. For each signal date, compute forward returns at +5, +10, +20 trading days
5. Return:
```js
{
  conditions: { indicator: 'rsi', operator: 'lt', threshold: 30 },
  results: [  // last 50 occurrences
    { entryTime, entryPrice, indicatorValue, pct5: 2.34, pct10: 4.12, pct20: 6.78 }
  ],
  stats: {
    totalSignals: 23,
    avgReturn5: 1.82, avgReturn10: 3.45, avgReturn20: 5.21,
    winRate5: 73.9, winRate10: 78.3, winRate20: 82.6,
    medianReturn5: 1.56, bestReturn5: 8.45, worstReturn5: -3.21
  }
}
```

---

### 1D. New API Routes

**File**: `layer-7-core-interface/api/src/modules/analysis/routes.js`

| Method | Endpoint | Handler | Query Params | Purpose |
|--------|----------|---------|-------------|---------|
| GET | `/api/market/analysis/:symbol` | `getFullAnalysis` | `interval`, `limit` | Combined: candles+indicators + overview + enhanced multi-TF + options PCR |
| GET | `/api/market/backtest/:symbol` | `getBacktest` | `indicator`, `operator`, `threshold`, `thresholdHigh` | Historical pattern backtest |
| GET | `/api/market/ai-predict/:symbol` | `getAIPrediction` | — | AI prediction from Layer 9 |

New controller handlers in `AnalysisController.js`:
- `getFullAnalysis` — calls service methods in parallel: `getCandlesWithFullIndicators`, `getStockOverview`, `getEnhancedMultiTimeframeSummary`, `getOptionsAnalysis`
- `getBacktest` — validates params, calls `runBacktest`
- `getAIPrediction` — calls `getAIPrediction`

---

### 1E. Layer 9 — Minor Update

**File**: `layer-9-ai-service/app/main.py`

Add `reasoning` field to `PredictionResponse` schema:
```python
class PredictionResponse(BaseModel):
    symbol: str
    prediction: float
    confidence: float
    model_version: str
    reasoning: str = ""          # ADD THIS
    prompt_tokens: int
    completion_tokens: int
```

Add `"reasoning": result.reasoning` to the `/predict` return dict.

---

## Phase 2: Frontend — Enhanced Symbol Page

### 2A. Enhanced Hook
**File**: `stock-analysis-portal/src/hooks/useAnalysis.js`

**New state variables:**
- `enhancedMultiTF` — full 6-TF analysis with verdicts
- `optionsData` — PCR data (null if unavailable)
- `aiPrediction` — AI prediction + reasoning
- `backtestResults` — backtest results + stats
- `aiLoading`, `backtestLoading` — loading states

**New fetch functions:**
- `fetchFullAnalysis(sym, interval)` — single call to `/api/market/analysis/:symbol` (replaces 3 separate calls)
- `fetchAIPrediction(sym)` — `/api/market/ai-predict/:symbol`
- `fetchBacktest(sym, indicator, operator, threshold)` — `/api/market/backtest/:symbol` (exposed for custom queries)

**Default behavior on page load:**
1. `fetchFullAnalysis(symbol, interval)` — main data
2. `fetchAIPrediction(symbol)` — AI analysis (async, non-blocking)
3. `fetchBacktest(symbol, 'rsi', 'lt', 30)` — default backtest: RSI < 30

---

### 2B. Enhanced Existing Components

#### `StockChart.jsx` — New Overlays
- **Bollinger Bands**: Upper + Lower as dashed lines (blue, 30% opacity). Controlled via `showBollinger` prop.
- **Supertrend**: Line colored green (direction=1) or red (direction=-1). Controlled via `showSupertrend` prop.
- Both toggleable via `IndicatorOverlayToggle` component.

#### `IndicatorPanel.jsx` — Add Volume Sub-Chart
- Third panel alongside RSI and MACD
- Volume histogram bars (green if close > open, red otherwise)
- 20-period moving average line overlay
- Header showing latest volume and volume ratio vs. avg

---

### 2C. New Components

**Directory**: `stock-analysis-portal/src/components/features/Analysis/components/`

#### `IndicatorOverlayToggle.jsx`
Toggle button row for chart overlays: **[EMA] [Bollinger] [Supertrend]**
- Active state: filled primary color
- Inactive: outlined/ghost

#### `CandlePatternBadges.jsx`
Displays last 5 detected candlestick patterns as colored badges.
- Green badge: Bullish patterns (Hammer, Bullish Engulfing, Morning Star, etc.)
- Red badge: Bearish patterns (Shooting Star, Bearish Engulfing, Evening Star, etc.)
- Shown below the main chart

#### `EnhancedMultiTFSummary.jsx`
Replaces the basic `MultiTimeframeSummary`. Full table:

| Timeframe | RSI | MACD | Trend (EMA) | Supertrend | BB Position | Verdict |
|-----------|-----|------|-------------|------------|-------------|---------|
| 5 Min     | 38  | +1.2 | Bullish     | Bullish    | Mid-Band    | **Bullish** (70%) |
| 15 Min    | 42  | -0.5 | Neutral     | Bearish    | Upper Band  | **Neutral** (30%) |
| ...       |     |      |             |            |             |         |

Each verdict = colored badge + confidence progress bar.

#### `PCRPanel.jsx`
Options analysis card. **Hidden if `data === null`** (no options data available).
- PCR (OI): value + color (>1 = Bullish, <0.7 = Bearish, else Neutral)
- PCR (Volume)
- Put OI vs Call OI visual bar
- Max Pain Strike
- Put/Call volume breakdown

#### `AIPredictionPanel.jsx`
AI prediction card with:
- Prediction gauge: "72% Bullish" (green) or "28% Bearish" (red)
- Confidence bar (0-100%)
- Reasoning text paragraph from AI
- Model version footnote
- Skeleton loading state

#### `BacktestPanel.jsx`
Historical pattern backtesting UI:

**Section 1 — Condition Builder:**
```
[Indicator ▼] [Operator ▼] [Threshold Input] [Run Button]
Presets: [RSI < 30] [RSI > 70] [MACD Histogram > 0]
```

**Section 2 — Statistics Grid:**
| Metric | 5-Day | 10-Day | 20-Day |
|--------|-------|--------|--------|
| Avg Return | +1.82% | +3.45% | +5.21% |
| Win Rate | 73.9% | 78.3% | 82.6% |
| Median Return | +1.56% | +2.89% | +4.12% |
| Best / Worst | +8.45% / -3.21% | ... | ... |

**Section 3 — Results Table (scrollable, last 50):**
| Date | Entry Price | RSI Value | 5D Return | 10D Return | 20D Return |
|------|-------------|-----------|-----------|------------|------------|
| 2024-03-15 | 2,380.50 | 28.4 | +2.34% | +4.12% | +6.78% |
- Green for positive returns, red for negative

---

### 2D. Updated Page Layout

**File**: `stock-analysis-portal/src/pages/analysis/[symbol].js`

```
┌────────────────────────────────────────────────────────┐
│ HEADER: [← Dashboard] [System] [Refresh]               │
├────────────────────────────────────────────────────────┤
│ STOCK HEADER: RELIANCE  ₹2,456.30  +1.23%  [Buy Badge]│
├────────────────────────────────────────────────────────┤
│ TIMEFRAME: [1m][5m][15m][30m][1H][4H][1D][1W]         │
│ OVERLAYS:  [EMA][Bollinger][Supertrend]                 │
├────────────────────────────────────────────────────────┤
│ MAIN CHART (candlestick + selected overlays)   450px   │
├────────────────────────────────────────────────────────┤
│ CANDLE PATTERNS: [Hammer ●] [Bullish Engulfing ●] ...  │
├────────────────────────────────────────────────────────┤
│ RSI Chart  │  MACD Chart  │  Volume Chart    120px ea  │
├─────────────────────┬──────────────────────────────────┤
│ Enhanced Multi-TF   │ Signal Breakdown                  │
│ Summary (6 TFs)     │ (RSI, Trend, Signal Badge)        │
├─────────────────────┼──────────────────────────────────┤
│ AI Prediction       │ Options PCR Analysis              │
│ (gauge + reasoning) │ (hidden if no options data)       │
├─────────────────────┴──────────────────────────────────┤
│ BACKTEST PANEL (full-width)                             │
│ [Condition Builder] [Statistics Grid] [Results Table]   │
├────────────────────────────────────────────────────────┤
│ FOOTER                                                  │
└────────────────────────────────────────────────────────┘
```

---

## Implementation Order

| # | Task | Files |
|---|------|-------|
| 1 | Fix `candles_1w` → `candles_weekly` | `AnalysisRepository.js` |
| 2 | Add new indicator imports (BB, ATR, bullish, bearish, etc.) | `AnalysisService.js` |
| 3 | Add calculation methods: BB, ATR, Supertrend, candlePatterns, PCR, computeVerdict | `AnalysisService.js` |
| 4 | Add repository methods: getOptionsChain, hasOptionsData | `AnalysisRepository.js` |
| 5 | Add composite methods: getCandlesWithFullIndicators, getEnhancedMultiTF, runBacktest, getAIPrediction, getOptionsAnalysis | `AnalysisService.js` |
| 6 | Add controller handlers + routes | `AnalysisController.js`, `routes.js` |
| 7 | Update Layer 9 PredictionResponse with reasoning field | `main.py` |
| 8 | Update useAnalysis hook (new state, new fetch functions) | `useAnalysis.js` |
| 9 | Enhance StockChart with BB + Supertrend overlays | `StockChart.jsx` |
| 10 | Enhance IndicatorPanel with Volume sub-chart | `IndicatorPanel.jsx` |
| 11 | Create new components (6 files) | `components/` |
| 12 | Restructure [symbol].js page layout | `[symbol].js` |
| 13 | Update barrel exports | `Analysis/index.js` |

---

## Files to Create

| File | Description |
|------|-------------|
| `stock-analysis-portal/src/components/features/Analysis/components/EnhancedMultiTFSummary.jsx` | 6-timeframe analysis table with verdicts |
| `stock-analysis-portal/src/components/features/Analysis/components/CandlePatternBadges.jsx` | Detected candle patterns as badges |
| `stock-analysis-portal/src/components/features/Analysis/components/PCRPanel.jsx` | Options put-call ratio analysis |
| `stock-analysis-portal/src/components/features/Analysis/components/AIPredictionPanel.jsx` | AI prediction gauge + reasoning |
| `stock-analysis-portal/src/components/features/Analysis/components/BacktestPanel.jsx` | Historical backtest condition builder + results |
| `stock-analysis-portal/src/components/features/Analysis/components/IndicatorOverlayToggle.jsx` | Chart overlay toggle buttons |

## Files to Modify

| File | Changes |
|------|---------|
| `layer-7-core-interface/api/src/modules/analysis/AnalysisRepository.js` | Fix 1w table name, add options queries |
| `layer-7-core-interface/api/src/modules/analysis/AnalysisService.js` | Add 6 indicator methods, 5 composite methods, verdict logic |
| `layer-7-core-interface/api/src/modules/analysis/AnalysisController.js` | Add 3 new handlers |
| `layer-7-core-interface/api/src/modules/analysis/routes.js` | Add 3 new routes |
| `layer-9-ai-service/app/main.py` | Add reasoning to PredictionResponse |
| `stock-analysis-portal/src/hooks/useAnalysis.js` | New state, new fetch functions, combined endpoint |
| `stock-analysis-portal/src/components/features/Analysis/components/StockChart.jsx` | BB + Supertrend overlays |
| `stock-analysis-portal/src/components/features/Analysis/components/IndicatorPanel.jsx` | Volume sub-chart |
| `stock-analysis-portal/src/pages/analysis/[symbol].js` | Full page restructure |
| `stock-analysis-portal/src/components/features/Analysis/index.js` | Export new components |

---

## Verification Checklist

- [ ] `GET /api/market/analysis/RELIANCE?interval=15m` — returns full indicators, 6-TF verdicts, options data
- [ ] `GET /api/market/backtest/RELIANCE?indicator=rsi&operator=lt&threshold=30` — returns results + stats
- [ ] `GET /api/market/ai-predict/RELIANCE` — returns AI prediction (requires Layer 9)
- [ ] `/analysis/RELIANCE` in browser — all panels render, chart overlays toggle
- [ ] Symbol with no options data — PCR panel hidden gracefully
- [ ] Backtest condition builder — custom queries work, presets work
- [ ] `1w` interval no longer errors (candles_weekly fix)
