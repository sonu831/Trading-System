# 🏗️ Architecture Diagrams

This document contains the architecture diagrams for the valid Nifty 50 Trading System. These are built using **Mermaid.js**, which renders natively in GitHub and is supported by VS Code extensions.

**Recommended VS Code Extension**: [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid)

---

## 1. High-Level System Overview (7 Layers)

```mermaid
graph TD
    subgraph L1_Ingestion [Layer 1: Ingestion]
        NSE[NSE Data Feed] -->|WebSocket| WS[WebSocket Manager]
        WS -->|Raw Ticks| Kafka[(Kafka: raw-ticks)]
    end

    subgraph L2_Processing [Layer 2: Processing]
        Kafka -->|Consumer| CandleBuilder[Candle Builder]
        CandleBuilder -->|OHLCV| Redis[(Redis: Hot)]
        CandleBuilder -->|OHLCV| Timescale[(TimescaleDB: Warm)]
    end

    subgraph L3_Storage [Layer 3: Storage]
        Redis
        Timescale
    end

    subgraph L4_Analysis [Layer 4: Analysis]
        Redis -->|Fetch Data| Analysis[Go Analysis Engine]
        Analysis -->|50 Goroutines| Indicators[Calculate Indicators]
        Indicators -->|RSI, MACD, Greeks| Redis
    end

    subgraph L5_Aggregation [Layer 5: Aggregation]
        Redis -->|Stock Data| Aggregator[Market Breadth Aggregator]
        Aggregator -->|Sector Rotation| Redis
    end

    subgraph L6_Signal [Layer 6: Signal]
        Redis -->|Market View| Decision[Decision Matrix]
        Decision -->|Scoring| Signal[Signal Generator]
    end

    subgraph L7_Presentation [Layer 7: Presentation]
        Signal -->|Pub/Sub| API[Fastify API]
        Signal -->|Pub/Sub| Bot[Telegram Bot]
        Signal -->|Pub/Sub| Dashboard[Next.js Dashboard]
    end

    style L1_Ingestion fill:#e1f5fe,stroke:#01579b
    style L2_Processing fill:#e8f5e9,stroke:#1b5e20
    style L3_Storage fill:#fff3e0,stroke:#e65100
    style L4_Analysis fill:#fce4ec,stroke:#880e4f
    style L5_Aggregation fill:#f3e5f5,stroke:#4a148c
    style L6_Signal fill:#e0f7fa,stroke:#006064
    style L7_Presentation fill:#fff8e1,stroke:#ff6f00
```

---

## 2. Detailed Data Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    participant NSE as NSE Feed
    participant L1 as L1: Ingestion
    participant Kafka
    participant L2 as L2: Processing
    participant Redis
    participant L4 as L4: Analysis
    participant L6 as L6: Signal
    participant User

    Note over NSE, User: Latency Budget: ~50ms
    
    NSE->>L1: Tick Data (Price Update)
    L1->>Kafka: Publish to 'raw-ticks' (Partition by Symbol)
    Kafka->>L2: Consume Tick
    L2->>L2: Update Candle (1m, 5m)
    L2->>Redis: Update 'candle:current:RELIANCE'
    
    par Parallel Analysis
        L2->>Redis: Pub/Sub 'event:candle_update'
        Redis->>L4: Trigger Analysis
        L4->>L4: Analyze 50 Stocks (Goroutines)
        L4->>Redis: Save Indicators (RSI, MACD)
    end

    L4->>L6: Trigger Signal Check
    L6->>L6: Run Decision Matrix
    
    alt Signal Generated
        L6->>Redis: Publish 'signal:buy'
        Redis->>User: Notify (Telegram/Dashboard)
    end
```

---

## 3. Signal Generation Logic (Flowchart)

```mermaid
flowchart TD
    Start([New Candle Data]) --> Input{Gather Inputs}
    
    Input --> Trend[Trend Analysis (25%)]
    Input --> Breadth[Market Breadth (20%)]
    Input --> Momentum[Momentum (15%)]
    Input --> Options[Options Flow (20%)]
    Input --> Sector[Sector Strength (10%)]
    Input --> Vol[Volatility (10%)]

    Trend --> Score
    Breadth --> Score
    Momentum --> Score
    Options --> Score
    Sector --> Score
    Vol --> Score

    Score[Calculate Composite Score] --> Decision{Score > 0.7?}
    
    Decision -->|Yes| Risk{Risk Check Passed?}
    Decision -->|No| Wait[No Signal]

    Risk -->|Yes| Buy[GENERATE BUY SIGNAL]
    Risk -->|No| Block[Signal Blocked (Risk)]
```
