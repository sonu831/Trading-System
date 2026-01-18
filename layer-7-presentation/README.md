# Layer 7: Presentation & API Layer 🖥️

## **What is this?**

Layer 7 is the user-facing interface of the system. It consists of two sub-services:

1.  **API Service (`/api`)**: A **Fastify** (Node.js) REST API that serves as the gateway to the backend data.
2.  **Dashboard Service (`/dashboard`)**: A **Next.js** (React) frontend application that provides a modern, interactive Master Control Panel for the user.

## **Why is it needed?**

- **Visibility**: Turns invisible data streams into actionable charts and grids.
- **Control**: Allows the user to toggle views (Live vs Historical) and monitor system health.

## **Architecture**

### 1. API Service (Port 4000)

- **Framework**: Fastify (Selected for high performance).
- **Role**: Connects to Redis and TimeScaleDB to fetch data.
- **Endpoints**:
  - `GET /api/v1/market-view`: Returns the aggregated market state (Sentiment, Breadth).
  - `GET /api/v1/signals`: Returns the latest trade signals.
  - `POST /api/v1/system/backfill/trigger`: Manually triggers a historical data catch-up for Layer 1.

### **System Control & Health**

- **Backfill Orchestration**: The API acts as a command gateway, publishing `START_BACKFILL` signals via Redis Pub/Sub to the Ingestion layer.
- **Telemetry Aggregation**: The `system-status` endpoint aggregates real-time Prometheus data from all 7 layers, including specialized network telemetry (Packets, Bandwidth) and background job progress.

### 2. Dashboard Service (Port 3000)

- **Framework**: Next.js 13 (Pages Router).
- **Styling**: Tailwind CSS with a custom "Premium Dark" theme.
- **Key Components**:
  - **`MarketOverview`**: Displays Live Sentiment (Emojis 🐂/🐻) and an advanced A/D Gauge.
  - **`TopMovers` (Carousel)**: A horiztonal scrolling list of top gainers/sectors.
  - **`NiftyGrid`**: A highly optimized (`React.memo`) data grid showing live stats for all 50 stocks. Features an interactive search.
  - **`SkeletonLoader`**: Provides a premium "shimmer" effect while data is loading.
- **Performance**:
  - Uses **Client-Side Polling** (smart-diffing) to update UI every 3 seconds without page refreshes.
  - **Optimization**: Components are memoized to prevent unnecessary re-renders during high-frequency updates.

## **How to Run**

Both are managed via Docker Compose, but can be run locally for dev:

```bash
# API
cd api && npm install && npm run dev

# Dashboard
cd dashboard && npm install && npm run dev
```
