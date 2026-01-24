# System Architecture - Technical Specification

> **Comprehensive technical documentation for the Nifty 50 Algorithmic Trading System**

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Layer-by-Layer Breakdown](#layer-by-layer-breakdown)
4. [Data Models & Schemas](#data-models--schemas)
5. [Communication Protocols](#communication-protocols)
6. [Performance Specifications](#performance-specifications)
7. [Security Architecture](#security-architecture)
8. [Monitoring & Observability](#monitoring--observability)
9. [Scalability & High Availability](#scalability--high-availability)
10. [Technology Stack Details](#technology-stack-details)

---

## System Overview

### High-Level Architecture

The system implements a **9-layer microservices architecture** with **event-driven communication** via Apache Kafka. Each layer is independently deployable, horizontally scalable, and follows the **Single Responsibility Principle**.

```
┌──────────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER (Layer 8)                     │
│  ┌────────────┬────────────────┬──────────────┐                   │
│  │ Telegram   │ Web Dashboard  │ Email Service│                   │
│  │ Bot        │ (React/Next.js)│ (Nodemailer) │                   │
│  └────────────┴────────────────┴──────────────┘                   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                      API GATEWAY (Layer 7)                        │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │ Fastify REST API + Socket.io WebSocket Server          │      │
│  │ ├─ Authentication (Redis Cache-Aside)                  │      │
│  │ ├─ Rate Limiting (Token Bucket)                        │      │
│  │ ├─ Request Validation (Ajv)                            │      │
│  │ └─ Structured Logging (Pino)                           │      │
│  └─────────────────────────────────────────────────────────┘      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
┌───────────▼──┐  ┌────────▼─────┐  ┌────▼──────────┐
│ Layer 6:     │  │ Layer 5:     │  │ Layer 4:      │
│ Signal       │◄─│ Aggregation  │◄─│ Analysis      │
│ Generation   │  │ (Market View)│  │ (Technicals)  │
│              │  │              │  │      │        │
└──────────────┘  └──────────────┘  └──────┼────────┘
                                            │
                                   ┌────────▼────────┐
                                   │ Layer 9:        │
                                   │ AI Service      │
                                   │ (ML Inference)  │
                                   └─────────────────┘
            │              │              │
┌───────────▼──────────────▼──────────────▼───────────┐
│              EVENT BUS (Apache Kafka)                │
│  Topics: raw-ticks, market_candles, analysis_updates│
└────────┬─────────────────────────────────────────────┘
         │
┌────────▼──────────┐
│ Layer 2:          │
│ Processing        │
│ (Candle Builder)  │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ Layer 1:          │
│ Ingestion         │
│ (WebSocket Broker)│
└────────┬──────────┘
         │
┌────────▼───────────────────────┐
│ External Data Sources          │
│ ├─ Zerodha Kite WebSocket     │
│ ├─ MStock API                 │
│ └─ FlatTrade API              │
└────────────────────────────────┘

         ┌────────────────────┐
         │ Layer 3: Storage   │
         │ ├─ TimescaleDB     │
         │ │  (Historical)    │
         │ └─ Redis           │
         │    (Real-time)     │
         └────────────────────┘
```

### Design Principles

1. **Microservices Architecture**: Each layer is a separate service
2. **Event-Driven**: Asynchronous communication via Kafka
3. **CQRS Pattern**: Separate read/write models (Redis for reads, TimescaleDB for writes)
4. **Circuit Breaker**: Fail-fast with graceful degradation
5. **Idempotency**: All Kafka consumers use idempotent processing
6. **Observability First**: Metrics, logs, traces for every operation

---

## Architecture Patterns

### 1. Event-Driven Architecture (EDA)

**Pattern**: Publish-Subscribe with Kafka

**Implementation**:

```
Producer (L1) → Kafka Topic (raw-ticks) → Consumer (L2)
              └─ Partition Key: Stock Symbol
              └─ Retention: 24 hours
              └─ Replicas: 1 (local), 3 (prod)
```

**Benefits**:

- Decoupling of services
- Horizontal scalability (add consumers)
- Replay capability for debugging

**Trade-offs**:

- Eventual consistency
- Complexity in ordering guarantees

### 2. CQRS (Command Query Responsibility Segregation)

**Write Model**: TimescaleDB (optimized for inserts)

```sql
INSERT INTO candles_1m (time, symbol, open, high, low, close, volume)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (symbol, time) DO UPDATE
SET close = EXCLUDED.close, volume = EXCLUDED.volume;
```

**Read Model**: Redis (optimized for lookups)

```redis
SET tick:latest:RELIANCE '{"ltp": 2850.50, "volume": 1500, "ts": 1705560000}'
EXPIRE tick:latest:RELIANCE 300
```

### 3. API Gateway Pattern

**Single Entry Point**: Layer 7 acts as BFF (Backend for Frontend)

**Responsibilities**:

- Request routing
- Authentication/Authorization
- Rate limiting
- Request/Response transformation
- Caching

**Technology**: Fastify (Node.js)

### 4. Strangler Fig Pattern

**Gradual Migration**: Layer 9 AI service designed to replace Layer 4 calculations

**Current State**:

```
Layer 4 (Go) → Calculates RSI, MACD → Calls Layer 9 for AI prediction
```

**Future State**:

```
Layer 9 (Python) → Calculates ALL indicators + AI prediction
Layer 4 (Go) → Deprecated or repurposed as aggregator
```

---

## Layer-by-Layer Breakdown

### Layer 1: Data Ingestion

**Technology**: Node.js 20 (TypeScript)

**Key Dependencies**:

```json
{
  "kafkajs": "^2.2.4",
  "ws": "^8.16.0",
  "@mstock-mirae-asset/nodetradingapi-typeb": "^1.0.0",
  "ioredis": "^5.3.2",
  "pino": "^8.19.0"
}
```

**Architecture**:

```
┌─────────────────────────────────────┐
│ WebSocket Connection Manager        │
│ ├─ Connection Pool (Max 5)          │
│ ├─ Heartbeat (every 30s)            │
│ ├─ Auto-Reconnect (Exponential)     │
│ └─ TOTP Generator (for MStock)      │
└─────────┬───────────────────────────┘
          │
┌─────────▼───────────────────────────┐
│ Tick Normalizer                     │
│ ├─ Vendor-specific parsers          │
│ ├─ Schema validation (Joi)          │
│ └─ Timestamp normalization          │
└─────────┬───────────────────────────┘
          │
┌─────────▼───────────────────────────┐
│ Kafka Producer                      │
│ ├─ Batch: 100 msgs or 10ms         │
│ ├─ Compression: Snappy              │
│ ├─ Idempotence: Enabled             │
│ └─ Acks: 1 (leader only)            │
└─────────────────────────────────────┘
```

**Data Flow**:

```typescript
interface RawTick {
  token: string; // Instrument token (e.g., "26000")
  symbol: string; // Stock symbol (e.g., "RELIANCE")
  ltp: number; // Last traded price
  volume: number; // Current volume
  bid: number; // Best bid price
  ask: number; // Best ask price
  timestamp: number; // Unix timestamp (ms)
  sequence: number; // Message sequence number
  exchange: string; // "NSE" | "BSE"
}
```

**Performance Metrics**:

- **Throughput**: 5,000 ticks/second (50 stocks \* 100 ticks/stock)
- **Latency**: <5ms (broker → Kafka)
- **Uptime**: 99.9% (with auto-reconnect)

**Error Handling**:

```typescript
class WebSocketManager {
  async connect() {
    try {
      await this.establishConnection();
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        await this.exponentialBackoff();
        return this.connect(); // Retry
      }
      // Circuit breaker: Switch to fallback broker
      await this.switchToFallbackBroker();
    }
  }
}
```

---

### Layer 2: Data Processing

**Technology**: Node.js 20 (TypeScript)

**Architecture**:

```
┌──────────────────────────────────────┐
│ Kafka Consumer Group                 │
│ ├─ Group ID: "candle-processors"    │
│ ├─ Partitions: 50 (one per stock)   │
│ ├─ Offset Commit: Every 100 msgs    │
│ └─ Rebalance Strategy: RoundRobin   │
└─────────┬────────────────────────────┘
          │
┌─────────▼────────────────────────────┐
│ In-Memory Candle Builders (Map)      │
│ {                                     │
│   "RELIANCE": CandleBuilder {        │
│     open: 2845.00,                   │
│     high: 2851.00,                   │
│     low: 2844.00,                    │
│     close: 2850.50,                  │
│     volume: 150000,                  │
│     startTime: 1705560000000,        │
│     trades: 350                      │
│   },                                 │
│   "TCS": CandleBuilder { ... }       │
│ }                                    │
└─────────┬────────────────────────────┘
          │ (Every 1 minute)
┌─────────▼────────────────────────────┐
│ Candle Finalizer                     │
│ ├─ Validate OHLC rules              │
│ ├─ Calculate VWAP                   │
│ ├─ Detect market gaps                │
│ └─ Persist to DB + Publish to Kafka  │
└──────────────────────────────────────┘
```

**Candle Close Logic**:

```typescript
class CandleBuilder {
  addTick(tick: RawTick): boolean {
    const tickTime = new Date(tick.timestamp);
    const candleEndTime = new Date(this.startTime + 60000); // +1 min

    if (tickTime >= candleEndTime) {
      this.finalize(); // Close candle
      return true; // Signal candle ready
    }

    // Update candle
    this.high = Math.max(this.high, tick.ltp);
    this.low = Math.min(this.low, tick.ltp);
    this.close = tick.ltp;
    this.volume += tick.volume;
    return false;
  }

  finalize(): Candle {
    return {
      time: new Date(this.startTime),
      symbol: this.symbol,
      open: this.open,
      high: this.high,
      low: this.low,
      close: this.close,
      volume: this.volume,
      trades: this.trades,
    };
  }
}
```

**Database Schema** (TimescaleDB):

```sql
CREATE TABLE candles_1m (
  time TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  open NUMERIC(10, 2),
  high NUMERIC(10, 2),
  low NUMERIC(10, 2),
  close NUMERIC(10, 2),
  volume BIGINT,
  trades INTEGER,
  vwap NUMERIC(10, 2),
  PRIMARY KEY (symbol, time)
);

-- Hypertable for time-series optimization
SELECT create_hypertable('candles_1m', 'time', partitioning_column => 'symbol');

-- Compression (auto after 7 days)
ALTER TABLE candles_1m SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol'
);

SELECT add_compression_policy('candles_1m', INTERVAL '7 days');

-- Retention (delete after 2 years)
SELECT add_retention_policy('candles_1m', INTERVAL '730 days');
```

**Performance**:

- **Write Throughput**: 50 candles/minute (batch insert)
- **Batch Size**: 50 rows (one per stock)
- **Latency**: <10ms (insert + publish)

---

### Layer 3: Storage Layer

#### TimescaleDB (Warm Storage)

**Configuration**:

```yaml
version: '3.8'
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: nifty50
      POSTGRES_USER: trading
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      TIMESCALEDB_TELEMETRY: 'off'
    volumes:
      - timescale_data:/var/lib/postgresql/data
    command:
      - postgres
      - -c shared_preload_libraries=timescaledb
      - -c max_connections=200
      - -c shared_buffers=512MB
      - -c effective_cache_size=1536MB
      - -c work_mem=32MB
```

**Indexes**:

```sql
-- Primary index (symbol, time DESC)
CREATE INDEX idx_candles_symbol_time ON candles_1m (symbol, time DESC);

-- Partial index for recent data
CREATE INDEX idx_candles_recent ON candles_1m (time DESC)
WHERE time > NOW() - INTERVAL '7 days';

-- GIN index for full-text search (future)
-- CREATE INDEX idx_candles_search ON candles_1m USING gin(to_tsvector('english', symbol));
```

**Query Performance**:

```sql
-- Fetch 300 candles for analysis (typical query)
EXPLAIN ANALYZE
SELECT time, open, high, low, close, volume
FROM candles_1m
WHERE symbol = 'RELIANCE'
  AND time >= NOW() - INTERVAL '5 hours'
ORDER BY time DESC
LIMIT 300;

-- Result: Index Scan, 3ms execution
```

#### Redis (Hot Storage)

**Data Structures**:

1. **Latest Tick** (String):

```redis
SET tick:latest:RELIANCE '{"ltp":2850.50,"volume":1500,"ts":1705560000}'
EXPIRE tick:latest:RELIANCE 300
```

2. **Current Candle** (Hash):

```redis
HSET candle:current:RELIANCE open 2845.00 high 2851.00 low 2844.00 close 2850.50 volume 150000
EXPIRE candle:current:RELIANCE 120
```

3. **Analysis Results** (Stream):

```redis
XADD analysis:results * symbol RELIANCE rsi 65.2 macd 12.5 trend BULLISH
XTRIM analysis:results MAXLEN ~ 1000
```

4. **Market View** (Sorted Set):

```redis
ZADD market:gainers 5.2 RELIANCE 4.8 TCS 3.5 INFY
ZRANGE market:gainers 0 9 WITHSCORES  # Top 10 gainers
```

**Pub/Sub Channels**:

```redis
PUBLISH tick:updates '{"symbol":"RELIANCE","ltp":2850.50}'
PUBLISH signal:alerts '{"action":"BUY","symbol":"TCS","price":3500}'
PUBLISH market:sentiment '{"overall":"BULLISH","breadth":2.5}'
```

**Memory Management**:

```redis
# Config
maxmemory 512mb
maxmemory-policy allkeys-lru
```

---

### Layer 4: Analysis Engine

**Technology**: Go 1.23

**Architecture**:

```
┌──────────────────────────────────────┐
│ HTTP Server (Gorilla Mux)            │
│ ├─ GET /analyze?symbol=X             │
│ ├─ GET /analyze/market                │
│ └─ GET /health                        │
└─────────┬────────────────────────────┘
          │
┌─────────▼────────────────────────────┐
│ Analysis Orchestrator                 │
│ ├─ Fan-Out: 50 goroutines            │
│ ├─ Fan-In: WaitGroup                 │
│ └─ Timeout: 5 seconds                │
└─────────┬────────────────────────────┘
          │
    ┌─────┴─────┐
    ↓           ↓
┌──────────┐ ┌──────────────────┐
│ Feature  │ │ AI Client        │
│ Engineer │ │ (HTTP Client)    │
│ (Techan) │ │ POST /predict    │
└──────────┘ └──────────────────┘
```

**Technical Indicators**:

1. **RSI (Relative Strength Index)**:

```go
func calculateRSI(candles []Candle, period int) float64 {
    gains, losses := 0.0, 0.0
    for i := 1; i <= period; i++ {
        change := candles[i].Close - candles[i-1].Close
        if change > 0 {
            gains += change
        } else {
            losses += -change
        }
    }
    avgGain := gains / float64(period)
    avgLoss := losses / float64(period)
    rs := avgGain / avgLoss
    rsi := 100 - (100 / (1 + rs))
    return rsi
}
```

2. **MACD (Moving Average Convergence Divergence)**:

```go
func calculateMACD(candles []Candle) (macd, signal, histogram float64) {
    ema12 := calculateEMA(candles, 12)
    ema26 := calculateEMA(candles, 26)
    macd = ema12 - ema26
    signal = calculateEMA(macdSeries, 9) // 9-period EMA of MACD
    histogram = macd - signal
    return
}
```

3. **Bollinger Bands**:

```go
func calculateBollinger(candles []Candle, period int, stdDev float64) (upper, middle, lower float64) {
    middle = calculateSMA(candles, period)
    variance := calculateVariance(candles, period, middle)
    sd := math.Sqrt(variance)
    upper = middle + (stdDev * sd)
    lower = middle - (stdDev * sd)
    return
}
```

**AI Integration**:

```go
type AIClient struct {
    baseURL    string
    httpClient *http.Client
    timeout    time.Duration
}

func (c *AIClient) Predict(features FeatureVector) (*Prediction, error) {
    payload := map[string]interface{}{
        "symbol":   features.Symbol,
        "features": features,
    }

    req, _ := http.NewRequest("POST", c.baseURL+"/predict", jsonPayload(payload))
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("AI service unavailable: %w", err)
    }
    defer resp.Body.Close()

    var prediction Prediction
    json.NewDecoder(resp.Body).Decode(&prediction)
    return &prediction, nil
}
```

**Concurrency Model**:

```go
func AnalyzeMarket(symbols []string) []Scorecard {
    results := make([]Scorecard, len(symbols))
    var wg sync.WaitGroup

    for i, symbol := range symbols {
        wg.Add(1)
        go func(idx int, sym string) {
            defer wg.Done()
            results[idx] = analyzeStock(sym)
        }(i, symbol)
    }

    wg.Wait()
    return results
}
```

**Scorecard Schema**:

```go
type Scorecard struct {
    Symbol          string    `json:"symbol"`
    Timestamp       time.Time `json:"timestamp"`
    LTP             float64   `json:"ltp"`

    // Technical Indicators
    RSI             float64   `json:"rsi"`
    MACD            MACDValue `json:"macd"`
    EMAs            EMAValues `json:"emas"`
    Bollinger       BBValues  `json:"bollinger"`

    // Composite Scores
    TrendScore      float64   `json:"trend_score"`        // -5 to +5
    MomentumScore   float64   `json:"momentum_score"`     // -5 to +5
    CompositeScore  float64   `json:"composite_score"`    // Average

    // AI Prediction
    AIPrediction    float64   `json:"ai_prediction"`      // 0 to 1
    AIConfidence    float64   `json:"ai_confidence"`      // 0 to 1
    AIModelVersion  string    `json:"ai_model_version"`

    // Recommendation
    Recommendation  string    `json:"recommendation"`     // STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
    LatencyMs       int64     `json:"latency_ms"`
}
```

---

### Layer 9: AI Inference Service

**Technology**: Python 3.11, FastAPI

**Architecture**:

```
┌──────────────────────────────────────┐
│ FastAPI Application                  │
│ ├─ POST /predict                     │
│ ├─ GET /health                       │
│ └─ GET /docs (Swagger)               │
└─────────┬────────────────────────────┘
          │
┌─────────▼────────────────────────────┐
│ Engine Factory (Strategy Pattern)    │
│                                       │
│ if provider == "heuristic":           │
│     return HeuristicEngine()         │
│ elif provider == "pytorch":           │
│     return PyTorchEngine()           │
│ elif provider == "openai":            │
│     return OpenAIEngine()            │
│ ...                                   │
└─────────┬────────────────────────────┘
          │
    ┌─────┴──────┬──────────┬──────────┬──────────┐
    ↓            ↓          ↓          ↓          ↓
┌─────────┐ ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Heuristic│ │ PyTorch │ │ OpenAI │ │ Claude │ │ Ollama │
│ Engine  │ │ Engine  │ │ Engine │ │ Engine │ │ Engine │
└─────────┘ └─────────┘ └────────┘ └────────┘ └────────┘
```

**Base Engine Interface**:

```python
from abc import ABC, abstractmethod
from pydantic import BaseModel

class FeatureVector(BaseModel):
    symbol: str
    rsi: float
    macd: float
    ema50: float
    ema200: float
    close: float
    volume: int

class PredictionResult(BaseModel):
    symbol: str
    prediction: float      # 0-1 (bearish to bullish)
    confidence: float      # 0-1
    model_version: str

class BaseEngine(ABC):
    @abstractmethod
    def predict(self, features: FeatureVector) -> PredictionResult:
        pass
```

**Heuristic Engine** (Default):

```python
class HeuristicEngine(BaseEngine):
    def predict(self, features: FeatureVector) -> PredictionResult:
        score = 0.5  # Neutral baseline

        # RSI signals
        if features.rsi < 30:
            score += 0.2  # Oversold → bullish
        elif features.rsi > 70:
            score -= 0.2  # Overbought → bearish

        # MACD signals
        if features.macd > 0:
            score += 0.15
        else:
            score -= 0.15

        # EMA crossover
        if features.ema50 > features.ema200:
            score += 0.15  # Golden cross
        else:
            score -= 0.15  # Death cross

        # Normalize to 0-1
        prediction = max(0.0, min(1.0, score))
        confidence = abs(prediction - 0.5) * 2  # Distance from neutral

        return PredictionResult(
            symbol=features.symbol,
            prediction=prediction,
            confidence=confidence,
            model_version="v1-heuristic"
        )
```

**PyTorch Engine** (LSTM Model):

```python
import torch
import torch.nn as nn

class LSTMPredictor(nn.Module):
    def __init__(self, input_size=6, hidden_size=50, num_layers=2):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        out = self.fc(lstm_out[:, -1, :])  # Last timestep
        return self.sigmoid(out)

class PyTorchEngine(BaseEngine):
    def __init__(self):
        self.model = LSTMPredictor()
        self.model.load_state_dict(torch.load('models/lstm.pth'))
        self.model.eval()

    def predict(self, features: FeatureVector) -> PredictionResult:
        # Convert features to tensor (sequence of 300 candles)
        input_tensor = self.prepare_input(features)

        with torch.no_grad():
            prediction = self.model(input_tensor).item()

        # Confidence based on prediction distance from 0.5
        confidence = abs(prediction - 0.5) * 2

        return PredictionResult(
            symbol=features.symbol,
            prediction=prediction,
            confidence=confidence,
            model_version="v2.1-lstm"
        )
```

**OpenAI Engine** (GPT-4):

```python
from openai import OpenAI

class OpenAIEngine(BaseEngine):
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def predict(self, features: FeatureVector) -> PredictionResult:
        prompt = f"""
        Analyze this stock based on technical indicators:
        Symbol: {features.symbol}
        RSI: {features.rsi}
        MACD: {features.macd}
        EMA50: {features.ema50}, EMA200: {features.ema200}
        Current Price: {features.close}

        Provide:
        1. Uptrend probability (0.0 to 1.0)
        2. Confidence level (0.0 to 1.0)

        Format: {{prediction: X.XX, confidence: Y.YY}}
        """

        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )

        # Parse response
        result = self.parse_response(response.choices[0].message.content)

        return PredictionResult(
            symbol=features.symbol,
            prediction=result['prediction'],
            confidence=result['confidence'],
            model_version="gpt-4-0613"
        )
```

**Performance Comparison**:

| Engine    | Latency (p50) | Latency (p95) | Accuracy | Cost/Call | Privacy |
| --------- | ------------- | ------------- | -------- | --------- | ------- |
| Heuristic | 5ms           | 8ms           | 70%      | Free      | 100%    |
| PyTorch   | 30ms          | 50ms          | 85%      | Free      | 100%    |
| OpenAI    | 150ms         | 300ms         | 90%      | $0.01     | Low     |
| Claude    | 150ms         | 300ms         | 92%      | $0.015    | Medium  |
| Ollama    | 80ms          | 150ms         | 75%      | Free      | 100%    |

---

## Data Models & Schemas

### Kafka Messages

**Topic: `raw-ticks`**

```json
{
  "token": "26000",
  "symbol": "RELIANCE",
  "ltp": 2850.5,
  "volume": 1500,
  "bid": 2850.25,
  "ask": 2850.75,
  "timestamp": 1705560000000,
  "sequence": 12345,
  "exchange": "NSE"
}
```

**Topic: `market_candles`**

```json
{
  "time": "2024-01-25T10:30:00Z",
  "symbol": "RELIANCE",
  "open": 2845.0,
  "high": 2851.0,
  "low": 2844.0,
  "close": 2850.5,
  "volume": 150000,
  "trades": 350,
  "vwap": 2847.8
}
```

**Topic: `analysis_updates`**

```json
{
  "symbol": "RELIANCE",
  "timestamp": "2024-01-25T10:31:00Z",
  "ltp": 2850.5,
  "rsi": 65.2,
  "macd": {
    "value": 12.5,
    "signal": 10.2,
    "histogram": 2.3
  },
  "emas": {
    "50": 2840.0,
    "200": 2800.0
  },
  "trend_score": 3.5,
  "ai_prediction": 0.82,
  "ai_confidence": 0.88,
  "recommendation": "STRONG_BUY"
}
```

### REST API Schemas

**GET /api/v1/analyze?symbol=RELIANCE**

Response:

```json
{
  "status": "success",
  "data": {
    "symbol": "RELIANCE",
    "timestamp": "2024-01-25T10:31:00Z",
    "ltp": 2850.5,
    "change": 1.2,
    "change_percent": 0.42,
    "indicators": {
      "rsi": 65.2,
      "macd": {
        "value": 12.5,
        "signal": 10.2,
        "histogram": 2.3
      },
      "emas": {
        "50": 2840.0,
        "100": 2820.0,
        "200": 2800.0
      },
      "bollinger": {
        "upper": 2860.0,
        "middle": 2850.0,
        "lower": 2840.0
      }
    },
    "scores": {
      "trend": 3.5,
      "momentum": 4.0,
      "composite": 3.75
    },
    "ai": {
      "prediction": 0.82,
      "confidence": 0.88,
      "model_version": "v2.1-lstm"
    },
    "recommendation": "STRONG_BUY",
    "meta": {
      "latency_ms": 85,
      "data_age_seconds": 2
    }
  }
}
```

---

## Communication Protocols

### Kafka Producer Configuration

```javascript
const kafka = new Kafka({
  clientId: 'ingestion-service',
  brokers: ['kafka:29092'],
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const producer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 5,
  transactionalId: 'ingestion-tx',
  compression: CompressionTypes.Snappy,
});

await producer.send({
  topic: 'raw-ticks',
  messages: [
    {
      key: 'RELIANCE', // Partition key
      value: JSON.stringify(tick),
      headers: {
        source: 'mstock',
        version: '1.0',
      },
    },
  ],
});
```

### Kafka Consumer Configuration

```javascript
const consumer = kafka.consumer({
  groupId: 'candle-processors',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

await consumer.subscribe({
  topic: 'raw-ticks',
  fromBeginning: false,
});

await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }) => {
    const tick = JSON.parse(message.value.toString());
    await processTickproducers(tick);
    await consumer.commitOffsets([
      {
        topic,
        partition,
        offset: (parseInt(message.offset) + 1).toString(),
      },
    ]);
  },
});
```

---

## Performance Specifications

### Latency Benchmarks

| Operation                       | Target | P50   | P95   | P99   |
| ------------------------------- | ------ | ----- | ----- | ----- |
| Tick Ingestion (Broker → Kafka) | <10ms  | 5ms   | 8ms   | 15ms  |
| Candle Processing (Kafka → DB)  | <50ms  | 30ms  | 45ms  | 60ms  |
| Technical Analysis (50 stocks)  | <100ms | 80ms  | 95ms  | 120ms |
| AI Inference (Heuristic)        | <20ms  | 10ms  | 15ms  | 25ms  |
| AI Inference (PyTorch)          | <100ms | 50ms  | 80ms  | 150ms |
| REST API Response               | <200ms | 120ms | 180ms | 250ms |
| WebSocket Broadcast             | <50ms  | 30ms  | 40ms  | 55ms  |

### Throughput

- **Kafka Ingestion**: 10,000 messages/sec
- **Database Writes**: 500 inserts/sec (batched)
- **API Requests**: 100 req/sec per instance
- **WebSocket Connections**: 1,000 concurrent connections

### Resource Usage (per container)

| Service        | CPU      | Memory | Disk I/O |
| -------------- | -------- | ------ | -------- |
| Ingestion      | 0.5 core | 256MB  | Low      |
| Processing     | 0.5 core | 512MB  | Medium   |
| Analysis       | 2 cores  | 1GB    | Low      |
| AI (Heuristic) | 0.2 core | 256MB  | Low      |
| AI (PyTorch)   | 1 core   | 2GB    | Medium   |
| Kafka          | 1 core   | 1GB    | High     |
| TimescaleDB    | 2 cores  | 2GB    | High     |
| Redis          | 0.5 core | 512MB  | Medium   |

---

## Security Architecture

### Authentication Flow

```
Client Request
    ↓
[API Gateway]
    ├─ Extract X-API-KEY header
    ├─ Check Redis cache: GET api_key:{key}
    │   ├─ HIT → Validate expiry → Allow
    │   └─ MISS → Query DB
    │       ├─ Found → Cache 5min → Allow
    │       └─ Not Found → 401 Unauthorized
    └─ Rate Limit Check
        ├─ GET rate_limit:{key}
        ├─ INCR rate_limit:{key}
        ├─ EXPIRE rate_limit:{key} 1
        └─ If count > limit → 429 Too Many Requests
```

### Rate Limiting (Token Bucket)

```javascript
async function checkRateLimit(apiKey) {
  const key = `rate_limit:${apiKey}`;
  const limit = await getLimit(apiKey); // e.g., 10 for Standard, 50 for Premium

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 1); // 1 second window
  }

  if (current > limit) {
    throw new RateLimitError('Too many requests');
  }
}
```

### Secrets Management

**Environment Variables** (`.env`):

```bash
# Never commit this file!
MSTOCK_API_KEY=encrypted_value
MSTOCK_PASSWORD=encrypted_value
MSTOCK_TOTP_SECRET=encrypted_value
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Production** (AWS Secrets Manager):

```bash
aws secretsmanager get-secret-value --secret-id prod/trading/mstock
```

---

## Monitoring & Observability

### Metrics (Prometheus)

**Custom Metrics**:

```javascript
// Counter: Total ticks received
const ticksTotal = new Counter({
  name: 'websocket_packets_total',
  help: 'Total WebSocket packets received',
  labelNames: ['symbol', 'vendor'],
});

ticksTotal.inc({ symbol: 'RELIANCE', vendor: 'mstock' });

// Histogram: Analysis latency
const analysisLatency = new Histogram({
  name: 'analysis_duration_seconds',
  help: 'Analysis duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const timer = analysisLatency.startTimer();
await analyzeStock('RELIANCE');
timer();

// Gauge: Active WebSocket connections
const wsConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Active WebSocket connections',
});

wsConnections.set(50);
```

### Logging (Pino)

```javascript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

logger.info(
  {
    reqId: 'req-abc-123',
    symbol: 'RELIANCE',
    latency_ms: 85,
    vendor: 'mstock',
  },
  'Analysis completed'
);
```

**Output**:

```json
{
  "level": "info",
  "timestamp": "2024-01-25T10:31:00.000Z",
  "reqId": "req-abc-123",
  "symbol": "RELIANCE",
  "latency_ms": 85,
  "vendor": "mstock",
  "msg": "Analysis completed"
}
```

### Tracing (Future: OpenTelemetry)

```javascript
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('trading-system');

const span = tracer.startSpan('analyze_stock');
span.setAttribute('symbol', 'RELIANCE');

try {
  const result = await analyzeStock('RELIANCE');
  span.setStatus({ code: 0 });
  return result;
} catch (error) {
  span.setStatus({ code: 2, message: error.message });
  throw error;
} finally {
  span.end();
}
```

---

## Scalability & High Availability

### Horizontal Scaling

**Kafka Partitioning**:

```
Topic: raw-ticks
Partitions: 50 (one per stock symbol)

Producer: Partition by symbol hash
Consumer Group: 5 instances (each consumes 10 partitions)
```

**Stateless Services**:

- Layer 1, 2, 4, 6, 7, 8 are stateless
- Can scale horizontally by adding more containers
- Load balanced via Docker Swarm or Kubernetes

### High Availability

**Database Replication** (Production):

```yaml
timescaledb:
  image: timescale/timescaledb:latest-pg15-ha
  environment:
    REPMGR_PARTNER_NODES: timescaledb-replica1,timescaledb-replica2
    REPMGR_PRIMARY_HOST: timescaledb
    REPMGR_NODE_NAME: timescaledb-primary
```

**Redis Sentinel** (Production):

```yaml
redis-sentinel:
  image: redis:7-alpine
  command: redis-sentinel /etc/redis/sentinel.conf
  volumes:
    - ./sentinel.conf:/etc/redis/sentinel.conf
```

**Kafka Replication**:

```
Topic: raw-ticks
Replication Factor: 3
Min In-Sync Replicas: 2
```

---

## Technology Stack Details

### Language Versions

- **Go**: 1.23
- **Node.js**: 20 (LTS)
- **Python**: 3.11

### Key Libraries

**Node.js**:

- `kafkajs`: ^2.2.4 - Kafka client
- `fastify`: ^4.26.0 - Web framework
- `socket.io`: ^4.6.1 - WebSockets
- `ioredis`: ^5.3.2 - Redis client
- `pino`: ^8.19.0 - Logging
- `@prisma/client`: ^5.9.1 - ORM

**Go**:

- `github.com/sdcoffey/techan`: Technical analysis
- `github.com/go-redis/redis/v8`: Redis client
- `github.com/jackc/pgx/v5`: PostgreSQL driver
- `github.com/gorilla/mux`: HTTP router
- `github.com/prometheus/client_golang`: Metrics

**Python**:

- `fastapi`: ^0.109.2 - Web framework
- `torch`: ^2.2.0 - Deep learning
- `pandas`: ^2.2.0 - Data manipulation
- `numpy`: ^1.26.3 - Numerical computing
- `openai`: ^1.12.0 - OpenAI API
- `anthropic`: ^0.18.0 - Claude API

---

## Appendix

### Glossary

- **OHLCV**: Open, High, Low, Close, Volume (candlestick data)
- **RSI**: Relative Strength Index (momentum indicator)
- **MACD**: Moving Average Convergence Divergence
- **EMA**: Exponential Moving Average
- **VWAP**: Volume Weighted Average Price
- **Tick**: Individual price update
- **Candle**: Aggregated price data over a time period

### References

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [TimescaleDB Best Practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/hypertables/)
- [Fastify Performance](https://www.fastify.io/benchmarks/)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
- [PyTorch LSTM Tutorial](https://pytorch.org/tutorials/beginner/nlp/sequence_models_tutorial.html)

---

**Last Updated**: 2024-01-25
**Document Version**: 1.0
**Maintained By**: Architecture Team
