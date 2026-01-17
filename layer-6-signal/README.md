# 🎯 Layer 6: Signal Generation

**Technology:** Node.js  
**Latency:** ~2ms  
**Responsibility:** Generate actionable trading signals from analysis

---

## 📋 Overview

The Signal Generation Layer takes the aggregated market state and individual stock analyses to generate actionable BUY/SELL signals for Nifty options trading.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DECISION MATRIX                          │
│                                                             │
│   Factor              Weight    Value      Contribution     │
│   ─────────────────────────────────────────────────────     │
│   Nifty Trend          25%     +0.8 ────────▶ +0.20        │
│   Market Breadth       20%     +0.65 ───────▶ +0.13        │
│   Momentum             15%     +0.4 ────────▶ +0.06        │
│   Options Flow         20%     +0.7 ────────▶ +0.14        │
│   Sector Rotation      10%     +0.5 ────────▶ +0.05        │
│   Volatility           10%     +0.3 ────────▶ +0.03        │
│   ─────────────────────────────────────────────────────     │
│   COMPOSITE SCORE:                            +0.61        │
│                                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SIGNAL RULES                             │
│                                                             │
│   Score > +0.7   →   STRONG BUY   →   Buy ATM Call         │
│   Score > +0.4   →   BUY          →   Bull Call Spread ✓   │
│   Score > -0.4   →   NEUTRAL      →   No Trade             │
│   Score > -0.7   →   SELL         →   Bear Put Spread      │
│   Score ≤ -0.7   →   STRONG SELL  →   Buy ATM Put          │
│                                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SIGNAL OUTPUT                            │
│                                                             │
│   Signal: BUY NIFTY 24500 CE (Weekly)                      │
│   Confidence: 72%                                           │
│   Stop Loss: ₹50                                           │
│   Target: ₹100                                             │
│   Risk:Reward: 1:2                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
layer-6-signal/
├── README.md
├── package.json
├── Dockerfile
│
├── src/
│   ├── index.js              # Entry point
│   │
│   ├── engine/
│   │   ├── decision-matrix.js # Weighted scoring
│   │   ├── signal-rules.js    # Signal generation rules
│   │   └── risk-manager.js    # Position sizing
│   │
│   └── strategies/
│       ├── options-selector.js # Options strategy selection
│       └── strike-picker.js    # Strike price selection
│
└── config/
    └── weights.json           # Factor weights configuration
```

## ⚙️ Configuration

### Factor Weights (config/weights.json)

```json
{
  "factors": {
    "trend": {
      "weight": 0.25,
      "components": ["ema_alignment", "supertrend", "price_vs_vwap"]
    },
    "breadth": {
      "weight": 0.20,
      "components": ["ad_ratio", "above_vwap_pct", "above_200ema_pct"]
    },
    "momentum": {
      "weight": 0.15,
      "components": ["rsi", "macd_histogram"]
    },
    "options": {
      "weight": 0.20,
      "components": ["pcr", "max_pain_deviation", "oi_buildup"]
    },
    "sectors": {
      "weight": 0.10,
      "components": ["banking_strength", "it_strength"]
    },
    "volatility": {
      "weight": 0.10,
      "components": ["india_vix", "atr_percentile"]
    }
  }
}
```

### Signal Rules

| Score Range | Signal | Strength | Options Strategy |
|-------------|--------|----------|------------------|
| > +0.7 | BUY | STRONG | Buy ATM/OTM Call |
| +0.4 to +0.7 | BUY | MODERATE | Bull Call Spread |
| -0.4 to +0.4 | NEUTRAL | - | No Trade |
| -0.7 to -0.4 | SELL | MODERATE | Bear Put Spread |
| < -0.7 | SELL | STRONG | Buy ATM/OTM Put |

## 📊 Signal Output Schema

```javascript
{
  id: "SIG-20240117-1030",
  timestamp: "2024-01-17T10:30:00.000Z",
  
  // Signal details
  type: "BUY",
  strength: "MODERATE",
  instrument: "NIFTY 24500 CE",
  expiry: "2024-01-18", // Weekly expiry
  
  // Entry/Exit
  entry_price: 75.00,
  stop_loss: 50.00,
  target_1: 100.00,
  target_2: 125.00,
  
  // Risk metrics
  risk_reward: "1:2",
  max_loss: 2500, // per lot
  confidence: 72,
  
  // Composite score breakdown
  composite_score: 0.61,
  factors: {
    trend: { score: 0.80, contribution: 0.20 },
    breadth: { score: 0.65, contribution: 0.13 },
    momentum: { score: 0.40, contribution: 0.06 },
    options: { score: 0.70, contribution: 0.14 },
    sectors: { score: 0.50, contribution: 0.05 },
    volatility: { score: 0.30, contribution: 0.03 }
  },
  
  // Market context
  nifty_spot: 24450,
  india_vix: 14.5,
  market_regime: "BULLISH_TRENDING"
}
```

## 🚀 Quick Start

```bash
npm install
npm start
```

---

**Previous:** [Layer 5 - Aggregation](../layer-5-aggregation/README.md)  
**Next:** [Layer 7 - Presentation](../layer-7-presentation/README.md)
