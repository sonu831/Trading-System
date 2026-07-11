# Skill: Docker Compose Orchestration

> **For infrastructure changes, adding services, or modifying deployment config.**

## 🚨 CRITICAL — ALWAYS use `--project-name trading-system`

Every `docker compose` command MUST include `--project-name trading-system`. Without it, Docker Compose derives the project name from the directory name, creating a **second project** (`compose`) whose containers cannot communicate with `trading-system` containers and cause port conflicts, name conflicts, and orphan warnings.

```bash
# ✅ CORRECT
docker compose --project-name trading-system --env-file .env -f infrastructure/compose/docker-compose.infra.yml up -d
docker compose --project-name trading-system --env-file .env -f infrastructure/compose/docker-compose.app.yml up -d --build backend-api

# ❌ WRONG — uses implicit project name from directory, never matches
docker compose -f infrastructure/compose/docker-compose.infra.yml up -d
docker compose -f infrastructure/compose/docker-compose.app.yml up backend-api
```

**After ANY code change that affects a container:**
```bash
# 1. Stop + remove old container (docker compose down doesn't always work cross-project)
docker stop <container-name> 2>/dev/null; docker rm <container-name> 2>/dev/null

# 2. Rebuild with project name
docker compose --project-name trading-system --env-file .env -f infrastructure/compose/<file>.yml up -d --build <service>

# 3. Verify all containers are under the SAME project
docker ps --format "table {{.Names}}\t{{.Label \"com.docker.compose.project\"}}\t{{.Status}}"
```

**The Makefile already uses `--project-name trading-system`.** Prefer `make` targets over raw docker commands:
```bash
make infra        # Start data stores
make app-core     # Start L1 + L7 + L10
make up           # Full stack
make restart-ingestion   # Rebuild + restart ingestion with .env
```

## ⚠️ Use shared/ PORTS — Never Hardcode

```js
const { PORTS } = require('/app/shared/constants');
// Use PORTS.EXECUTION (8095), not 8090 (which is Kafka UI)
```

All 19 port numbers are defined once in `shared/constants.js`. See `shared/README.md`.

## Architecture

```
docker-compose.yml       -- Root: includes all modules
├── infrastructure/       -- Kafka, Zookeeper, TimescaleDB, Redis
├── observability/        -- Prometheus, Grafana, Loki, Promtail
├── services/             -- Layers 1-9
└── ui+notify/            -- Dashboard + notification service
```

## Key Makefile Commands

```bash
make up                 # Full stack (infra + wait + services + UI)
make down               # Full teardown
make infra              # Infrastructure only
make dev                # Infra + hot-reload dev mode
make layer<N>           # Run single layer
make test               # All tests
make backup             # Database backup
make restore            # Database restore
```

## Adding a New Service

1. Add Dockerfile in the layer directory
2. Add service definition in docker-compose.yml
3. Add health check
4. Add Prometheus metrics endpoint (/metrics or /health)
5. Add to Makefile targets
6. Test with `docker-compose up <service-name>`

## Service Template

```yaml
layer-N-service:
  build:
    context: ./layer-N-directory
    dockerfile: Dockerfile
  container_name: trading-layer-N
  restart: unless-stopped
  environment:
    - KAFKA_BROKERS=kafka:9092
    - REDIS_URL=redis://redis:6379
    - DB_URL=postgresql://user:pass@timescaledb:5432/trading
  depends_on:
    kafka:
      condition: service_healthy
    redis:
      condition: service_healthy
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:${PORT}/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  networks:
    - trading-network
```

## Networking

- All services on `trading-network` (internal Docker network)
- Only API gateway + dashboard exposed to host
- Databases NEVER exposed to host in production
- Kafka advertised listeners: internal (kafka:9092), external (localhost:9093 for dev)

## Observability

- **Prometheus**: scrape `/metrics` from every service
- **Grafana**: dashboards at `infrastructure/grafana/dashboards/`
- **Loki**: centralized logs via promtail
- **AlertManager**: alerts for service down, high lag, disk usage

## Rules

1. **Never expose databases to public network**
2. **Always use named volumes** for persistent data
3. **Graceful shutdown** -- every service handles SIGTERM
4. **Resource limits on every container** -- CPU + memory
5. **Secrets via environment variables** -- never in docker-compose.yml
6. **Always add health checks** -- no service without health check
