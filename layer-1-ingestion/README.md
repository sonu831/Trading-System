# Layer 1: Ingestion Service 📡

## **What is this?**

The Ingestion Layer is the entry point of the entire trading system. It is a **Node.js** application responsible for establishing a persistent WebSocket connection with the stock broker (MStock/Mirae Asset) to receive real-time market data (ticks).

## **Why is it needed?**

- **Real-Time Data**: Analysis requires live price updates, not delayed HTTP responses.
- **Decoupling**: It isolates the broker connection logic from the rest of the system. If the broker API changes, only this layer needs updates.
- **Buffering**: It acts as a producer, buffering rapid-fire ticks into a robust message queue (Kafka), preventing downstream systems from being overwhelmed.

## **How it works**

1.  **Authentication**: It uses `MStockV2` SDK to authenticate with the broker using credentials managed in environment variables.
2.  **Subscription**: It subscribes to the "Live Feed" for the designated **Nifty 50** tokens.
3.  **Normalization**: Raw binary/JSON packets from the broker are parsed and normalized into a standard `Tick` structure:
    ```json
    {
      "token": "26000",
      "ltp": 21500.5,
      "volume": 1500,
      "timestamp": 1705560000
    }
    ```
4.  **Publishing**: These normalized ticks are pushed to the **Kafka Topic** `market_ticks`.

## **Key Logs & Monitoring**

- `[INFO] Connected to MStock WebSocket`: Indicates successful broker connection.
- `[INFO] Kafka Producer Ready`: Confirms data pipeline is open.
- `[DEBUG] Tick received for 26000`: (Verbose) Shows data flow.

## **Historical Backfill 🕰️**

The service includes a background task for catching up on missing historical data (last 5 days).

- **Auto-Trigger**: Starts automatically if the market is closed during service startup.
- **Manual Trigger**: Can be forced via Redis Pub/Sub on channel `system:commands` with message `START_BACKFILL`.
- **Stages**:
  1.  **Batch Fetch**: Launches `scripts/batch_nifty50.js` to download OHLC data via HTTP.
  2.  **Kafka Feed**: Launches `scripts/feed_kafka.js` to push downloaded data into the Kafka pipeline.
- **IPC Bridge**: Background scripts use `process.send()` to report metrics (API calls, latency) back to the parent process for global monitoring.

## **Advanced Telemetry 📊**

The ingestion layer tracks deep network metrics:

- `websocket_packets_total`: Total count of market data broadcasts received.
- `websocket_data_bytes_total`: Estimated bandwidth consumed (bytes).
- `external_api_calls_total`: HTTP request tracking for all vendors (labeled by endpoint/status).
- `batch_job_status`: Tracks the health and progress of the backfill task.

## **Configuration**

| Env Variable   | Description                        |
| -------------- | ---------------------------------- |
| `MSTOCK_USER`  | Broker User ID                     |
| `MSTOCK_PASS`  | Broker Password                    |
| `KAFKA_BROKER` | Kafka Host (default: `kafka:9092`) |
