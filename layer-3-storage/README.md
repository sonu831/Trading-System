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

### 1. External Persistence
Data is stored on the external drive at `/Volumes/Yogi-External/personal/trading-data`. This ensures data survives project deletions (`make clean`).

### 2. Backup Strategies
The system implements a 3-tier backup strategy:

1.  **SQL Dumps (`make backup`)**:
    *   Creates a `.sql` file in `./backups/`.
    *   Best for portability (moving to cloud/other machines).
    *   *Auto-Deduplication*: Automatically deletes duplicate or empty backups.

2.  **File-Level Snapshots (`make snapshot`)**:
    *   Copies the entire external data directory to `./backups/snapshots/`.
    *   Best for instant, full-state recovery on the same machine.

3.  **Automated Sync (`make auto-sync`)**:
    *   Background daemon that syncs external data to your Local Mac (`~/trading-backups`) every 30 minutes.
    *   Logs sync status and timestamps to the internal `backup_logs` table.
    *   **Disaster Recovery**: If external drive fails, copied data exists on your laptop.

### 3. Lifecycle Automation
*   **Shutdown Hook**: Running `make down` automatically triggers a backup and a local sync to ensure safely before stopping containers.

### 4. Restoration
*   **Restore SQL**: `make restore` (Follow prompts).
*   **Restore Snapshot**: Manually copy files from `backups/snapshots/` back to the external volume path.
