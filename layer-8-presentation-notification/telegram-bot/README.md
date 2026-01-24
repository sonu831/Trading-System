# Telegram Bot Service (Layer 8)

A production-grade, modular Telegram Bot for the Guru Ji Trading System.

## Architecture

This service follows a layered architecture to ensure separation of concerns, testability, and scalability.

```
src/
├── config/         # Environment variables & constants
├── core/           # Infrastructure (Redis, Kafka, Logger, Bootstrap)
├── services/       # Business Logic (Market Data, Auth, Backfill)
├── bot/            # Presentation Layer (Telegraf, Commands, Middleware)
├── utils/          # Helpers
└── app.js          # Entry Point
```

## Key Components

- **Dependency Injection:** Services and Core modules are singletons that can be mocked for testing.
- **Structured Logging:** Uses `pino` for JSON-formatted logs with request context (instanceId, user).
- **Infrastructure wrappers:** `core/redis.js` and `core/kafka.js` handle connection retries and error logging.
- **Bootstrap:** `core/bootstrap.js` manages clean startup and graceful shutdown sequences.

## Setup

1.  **Environment Variables:**
    Ensure `.env` contains:

    ```bash
    TELEGRAM_BOT_TOKEN=your_token
    REDIS_URL=redis://redis:6379
    KAFKA_BROKERS=kafka:29092
    ```

2.  **Run Locally:**

    ```bash
    npm install
    npm run dev
    ```

3.  **Run via Docker:**
    ```bash
    docker-compose up -d telegram-bot
    ```

## Commands

| Command            | Description                        |
| :----------------- | :--------------------------------- |
| `/start`           | Welcome & Subscription             |
| `/feed`            | Market Snapshot (Advance/Decline)  |
| `/high`            | Top 10 Gainers                     |
| `/low`             | Top 10 Losers                      |
| `/movers`          | Most Active Stocks                 |
| `/status`          | System Health Check                |
| `/backfill [days]` | Trigger historical data fetching   |
| `/livestatus`      | Real-time backfill progress stream |

## Troubleshooting

- **Bot not replying?** Check logs for `TELEGRAM_BOT_TOKEN` errors or Kafka/Redis connection failures.
- **"Conflict" error?** You have multiple instances running with the same token. Stop older containers.
