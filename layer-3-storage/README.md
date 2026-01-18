# Layer 3: Storage

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview

This layer manages the persistence of market data using Redis (Hot) and TimescaleDB (Warm/Cold).

## Technology Stack

- **Hot Storage**: Redis Cluster
- **Warm Storage**: TimescaleDB (PostgreSQL)

## 🚀 How to Run

These are infrastructure services, typically run via Docker.

### Docker (Recommended)

```bash
# Start Storage Layer
docker-compose up -d redis timescaledb
```

### Accessing Data

**Redis CLI:**

```bash
docker exec -it redis redis-cli
> GET tick:latest:RELIANCE
```

**TimescaleDB (SQL):**

```bash
docker exec -it timescaledb psql -U user -d trading
> SELECT * FROM candles_1m ORDER BY time DESC LIMIT 5;
```

## Authors

- **Yogendra Singh**
