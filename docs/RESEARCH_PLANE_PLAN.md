# Research Plane — k-NN Analog Matching Engine

> **Status:** PLAN | **Date:** 2026-07-10

## Problem

When a trader sees the current market regime (trend=TREND_UP, volatility=HIGH, breadth=BULLISH), they want to know: **"What happened the last 10 times the market looked exactly like this?"**

Currently, the system has no way to answer this. The backtest engine runs strategies on history, but there's no "find similar historical moments" capability.

## Architecture — Three Planes

```
┌────────── CONTROL PLANE (Dashboard → API → Config) ──────────┐
│  Providers · Strategies · Risk · Kill Switch                  │
└──────────────────────┬────────────────────────────────────────┘
                       │
┌──────────────────────▼────── DATA PLANE (Kafka pipeline) ─────┐
│  L1 → L2 → L4 → L5 → L6 → L10                               │
└──────────────────────┬────────────────────────────────────────┘
                       │ stores regime + outcome
┌──────────────────────▼────── RESEARCH PLANE (NEW) ────────────┐
│  Regime Snapshots DB → Feature Vector → k-NN Search → Report │
│                                                               │
│  1. Every L6 regime evaluation → store snapshot (feature vec) │
│  2. Signal outcome → label snapshot (win/loss/pnl)            │
│  3. Query: "find 10 most similar regimes to right now"        │
│  4. Report: "7/10 were profitable, avg P&L +₹850"             │
└──────────────────────────────────────────────────────────────┘
```

## Feature Vector (what we store per regime snapshot)

```typescript
interface RegimeSnapshot {
  timestamp: string;
  
  // Multi-TF trend vectors
  tf_5m_trend: 'TREND_UP' | 'TREND_DOWN' | 'RANGE';
  tf_15m_trend: string;
  tf_1h_trend: string;
  tf_D_trend: string;
  
  // Numerical features (normalized 0-1)
  trend_strength: number;      // 0-1
  volatility: 'HIGH' | 'NORMAL' | 'LOW';
  atr_pct: number;             // ATR as % of spot
  vix_value: number;           // India VIX
  breadth_adv_decl_ratio: number;
  breadth_pct_above_ema20: number;
  rsi_14: number;
  
  // Outcome (populated later)
  signal_outcome?: 'WIN' | 'LOSS' | 'NO_TRADE';
  signal_pnl?: number;
  signal_strategy?: string;
  signal_tier?: 'T1' | 'T2' | 'T3';
}
```

## k-NN Algorithm

```python
def find_analogs(current: RegimeSnapshot, k=10):
    """
    1. Load all historical snapshots from TimescaleDB
    2. Compute Euclidean distance on normalized feature vectors
    3. Return k-nearest neighbors ranked by similarity
    """
    features = normalize([trend_strength, atr_pct, vix_value, 
                          breadth_adv_decl_ratio, breadth_pct_above_ema20, rsi_14])
    
    # Categorical features → one-hot for distance calc
    distances = []
    for snap in history:
        dist = euclidean_distance(current.features, snap.features)
        distances.append((dist, snap))
    
    distances.sort()
    return distances[:k]
```

## Storage

```sql
CREATE TABLE regime_snapshots (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,  -- 'NIFTY' | 'BANKNIFTY'
    feature_vector JSONB NOT NULL,
    signal_id VARCHAR(64),
    outcome VARCHAR(10),          -- WIN | LOSS | NO_TRADE
    pnl DECIMAL(10,2),
    
    PRIMARY KEY (time, symbol)
);

SELECT create_hypertable('regime_snapshots', 'time');
CREATE INDEX idx_snapshots_symbol_time ON regime_snapshots (symbol, time DESC);
```

## API Endpoints (L7)

```
GET /api/v1/research/analogs?underlying=NIFTY&k=10
  → Returns: [
      { similarity: 0.94, date: '2026-06-15', outcome: 'WIN', pnl: +850 },
      { similarity: 0.91, date: '2026-06-12', outcome: 'LOSS', pnl: -320 },
      ...
    ]
    with summary: { winRate: 0.70, avgPnl: +425, maxPnl: +2100, minPnl: -1200 }

GET /api/v1/research/regime-distribution?underlying=NIFTY
  → Returns: histogram of outcomes per regime type
```

## Dashboard Integration

Add a panel to `/scalp` showing "Historical Analogs":
```
┌─────────────────────────────────────┐
│ Historical Analogs (k=10)           │
│ Similarity: ●●●●○ (4.2/5 avg)       │
│                                     │
│ 7/10 profitable · Avg +₹850         │
│ Best: +₹2,100 · Worst: -₹1,200      │
│                                     │
│ ████████░░ Win (70%)                │
│ ███░░░░░░░ Loss (30%)               │
└─────────────────────────────────────┘
```

## Implementation Phases

| Phase | What | Effort |
|-------|------|--------|
| **R1** | Store regime snapshots to TimescaleDB (L6 → DB on every evaluation) | 30m |
| **R2** | k-NN query endpoint (L7 → DB query + distance calc) | 1h |
| **R3** | Dashboard panel showing analog results | 1h |
| **R4** | Auto-label snapshots with trade outcomes | 30m |

## Rule 13 Compliance — Synthetic Data Labeling

Every piece of data MUST declare its source. Synthetic data that looks real is dangerous.

```typescript
// ❌ Current: OptionSimulator output has no source tag
{ ltp: 123.45, bid: 122.00, ask: 124.50 }

// ✅ Required: Every data point declares its provenance
{ 
  ltp: 123.45, bid: 122.00, ask: 124.50,
  source: 'synthetic',          // ← MANDATORY
  model: 'black-scholes',       // which model generated it
  synthetic: true,              // ← single boolean gate
  generated_at: '2026-07-10T14:00:00Z'
}
```

**Enforcement points:**
1. `OptionSimulator.simulateTrade()` → add `source: 'synthetic'` to every output
2. `PaperExecutor` → add `synthetic: true` to every trade journal entry
3. `QuoteFeed.ensureSymbol()` with seed > 0 → tag as synthetic
4. Dashboard: render `⚠️ SIMULATED` badge on any synthetic data
