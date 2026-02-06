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

## Backup & Disaster Recovery

### 1. Local Persistence
Data is stored in the project's `data/` directory. This keeps all persistent data together with the project.

### 2. Backup Strategies

1.  **SQL Dumps (`make backup`)**:
    *   Creates a `.sql` file in `./backups/`.
    *   Best for portability (moving to cloud/other machines).
    *   *Auto-Deduplication*: Automatically deletes duplicate or empty backups.

2.  **File-Level Snapshots (`make snapshot`)**:
    *   Copies the entire data directory to `./backups/snapshots/`.
    *   Best for instant, full-state recovery.

### 3. Restoration
*   **Restore SQL**: `make restore` (Follow prompts).
*   **Restore Snapshot**: Manually copy files from `backups/snapshots/` back to `data/`.

