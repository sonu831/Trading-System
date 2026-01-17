# 📊 Layer 5: Aggregation

**Technology:** Go  
**Latency:** ~3ms  
**Responsibility:** Combine 50 stock analyses into market-level insights

---

## 📋 Overview

The Aggregation Layer waits for all 50 stock analyses to complete (barrier synchronization), then calculates market-wide metrics:

- **Market Breadth**: Advance/Decline ratio, % above VWAP/200 EMA
- **Sector Analysis**: Sector strength and rotation phase
- **Relative Strength**: RS rankings, leaders/laggards

## 🏗️ Architecture

```
Wait for ALL 50 stocks to complete (Barrier)
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│              PARALLEL AGGREGATIONS                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   MARKET    │  │   SECTOR    │  │  RELATIVE   │         │
│  │   BREADTH   │  │  ANALYSIS   │  │  STRENGTH   │         │
│  │             │  │             │  │             │         │
│  │ • A/D Ratio │  │ • Banking   │  │ • RS Rank   │         │
│  │ • A/D Line  │  │ • IT        │  │ • Momentum  │         │
│  │ • % > VWAP  │  │ • FMCG      │  │ • Leaders   │         │
│  │ • % > 200EMA│  │ • Auto      │  │ • Laggards  │         │
│  │ • New H/L   │  │ • Pharma    │  │             │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  MARKET STATE                        │   │
│  │                                                      │   │
│  │   Regime: BULLISH_TRENDING                          │   │
│  │   Confidence: 78%                                    │   │
│  │   Risk Level: MEDIUM                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
layer-5-aggregation/
├── README.md
├── go.mod
├── Dockerfile
│
├── cmd/
│   └── main.go
│
├── internal/
│   ├── breadth/
│   │   └── calculator.go    # Market breadth calculations
│   │
│   ├── sectors/
│   │   └── analyzer.go      # Sector rotation analysis
│   │
│   └── strength/
│       └── rankings.go      # Relative strength rankings
│
└── config/
    └── config.yaml
```

## 📊 Output: Market State

```json
{
  "timestamp": "2024-01-17T10:30:00Z",
  "regime": "BULLISH_TRENDING",
  "confidence": 78,
  "risk_level": "MEDIUM",
  
  "breadth": {
    "advancing": 35,
    "declining": 12,
    "unchanged": 3,
    "ad_ratio": 2.92,
    "above_vwap_pct": 72,
    "above_200ema_pct": 68,
    "new_highs": 8,
    "new_lows": 1
  },
  
  "sectors": {
    "Banking": { "strength": 0.72, "phase": "LEADING" },
    "IT": { "strength": 0.45, "phase": "WEAKENING" },
    "FMCG": { "strength": 0.38, "phase": "LAGGING" },
    "Auto": { "strength": 0.55, "phase": "IMPROVING" }
  },
  
  "leaders": ["RELIANCE", "HDFCBANK", "ICICIBANK"],
  "laggards": ["WIPRO", "TECHM", "INFY"]
}
```

---

**Previous:** [Layer 4 - Analysis](../layer-4-analysis/README.md)  
**Next:** [Layer 6 - Signal](../layer-6-signal/README.md)
