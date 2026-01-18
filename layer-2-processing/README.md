# Layer 2: Processing Service ⚙️

## **What is this?**

The Processing Layer is a high-performance **Golang** service. It is the "Data Refinery" of the system. It consumes the raw stream of ticks from Layer 1 and converts them into structured, analyzable data blocks called **Candles** (OHLCV - Open, High, Low, Close, Volume).

## **Why is it needed?**

- **Noise Reduction**: Raw ticks are too granular for trend analysis. Aggregating them into 1-minute candles provides a cleaner signal.
- **Persistence**: It ensures every piece of market history is safely stored in **TimeScaleDB** for future backtesting and historical analysis.

## **How it works**

1.  **Kafka Consumer**: Listens to the `market_ticks` topic.
2.  **Aggregation Engine**:
    - Maintains an in-memory "Current Candle" for every stock token.
    - **Logic**:
      - If internal candle time < 1 minute: Update `High`, `Low`, `Close`, `Volume`.
      - If 1 minute passed: "Closes" the candle, flushes it to DB, and starts a new one.
3.  **Database Write**: Uses `pgx` (Postgres Driver) to bulk-insert closed candles into `candles_1m` hypertable.

## **Key Logs & Monitoring**

- `[INFO] Candle Closed: RELIANCE`: Indicates a minute bar was completed.
- `[INFO] DB Write Success`: Confirms data implementation persistence.

## **Tech Stack**

- **Language**: Go 1.21+
- **Libraries**: `segmentio/kafka-go`, `jackc/pgx`
