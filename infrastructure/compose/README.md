# Docker Compose Modules

This folder contains the modular Docker Compose files for the Trading System.

## 📁 Files

| File                         | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `docker-compose.infra.yml`   | Data stores (Kafka, Redis, TimescaleDB) + Admin UIs |
| `docker-compose.app.yml`     | Application pipeline (L1-L6 + API)                  |
| `docker-compose.ui.yml`      | Frontend (Dashboard)                                |
| `docker-compose.observe.yml` | Observability (Prometheus, Grafana, Exporters)      |
| `docker-compose.gateway.yml` | Public exposure (Nginx Gateway + Cloudflare Tunnel) |

## 🚀 Usage

Use the Makefile shortcuts from the project root:

```bash
# Core commands
make up        # Full stack (infra + app + ui)
make down      # Stop everything

# Granular control
make infra     # Start data stores
make app       # Start pipeline
make ui        # Rebuild dashboard
make observe   # Start monitoring

# Public exposure
make gateway   # Start Nginx gateway only
make share     # Start gateway + tunnel, show URL
make share-url # Show public URL
make share-down # Stop gateway and tunnel
```

## 🔗 Network

All files share the same Docker network: `compose_trading-network`

The `infra.yml` creates the network, and all others reference it as `external`.

## 📖 See Also

- [Infrastructure INSTRUCTIONS](../INSTRUCTIONS.md) - Setup guide
- [Root README](../../README.md) - Project overview
- [EXPOSURE_GUIDE](../../EXPOSURE_GUIDE.md) - Public sharing guide
