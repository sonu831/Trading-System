# 🏗️ Infrastructure & Deployment Instructions

This document details the standardized infrastructure setup for the Nifty 50 Trading System, designed for scalability and "GitOps" management.

## 📂 Directory Structure

We use a **Flat Base** Kustomize structure for simplicity and clarity.

```text
infrastructure/
├── kubernetes/
│   ├── base/                           # Shared manifests (Single Source of Truth)
│   │   ├── layer-1.yaml                # Ingestion Layer
│   │   ├── layer-2.yaml                # Processing Layer (Auto-Scaling)
│   │   ├── layer-3.yaml                # Storage (Redis/Timescale)
│   │   ├── layer-4.yaml                # Analysis Layer (Auto-Scaling)
│   │   ├── layer-5.yaml                # Aggregation Layer
│   │   ├── layer-6.yaml                # Signal Layer
│   │   ├── layer-7.yaml                # Presentation Bundle (API+Dash+Bot)
│   │   ├── observability.yaml          # Full Stack (Prom + Grafana + OTEL)
│   │   └── kustomization.yaml          # Root entry point
│   └── overlays/                       # Environment-specific patches
│       └── dev/                        # Development Configuration
├── monitoring/                         # Configuration as Code
│   ├── grafana/                        # Dashboards & Provisioning
│   ├── prometheus/                     # Scraping Configs
│   └── otel-collector-config.yaml      # Telemetry Pipelines
└── docker/                             # Shared Docker utilities (if any)
```

## 🚀 How to Deploy (Kubernetes)

We use **Kustomize** to deploy. This renders the templates and applies them to your cluster.

### 1. Preview Deployment

Always check what will be applied:

```bash
kubectl kustomize infrastructure/kubernetes/overlays/dev
```

### 2. Apply Deployment

Deploy the entire system (Apps + Monitoring):

```bash
kubectl apply -k infrastructure/kubernetes/overlays/dev
```

### 3. Verify Scaling

Check if Horizontal Pod Autoscalers (HPA) are active:

```bash
kubectl get hpa -n nifty50-system
```

## 🔭 Monitoring & Observability

The monitoring stack is fully declarative ("Configuration as Code").

- **Dashboards**: Edit JSON files in `infrastructure/monitoring/grafana/dashboards/`.
- **Alerts**: Configured in Grafana UI (or future provisioning).
- **Pipelines**: Edit `observability.yaml` to change OTEL behavior.

For detailed monitoring guides, see [infrastructure/monitoring/README.md](monitoring/README.md).

## 🐳 Local Development (Docker Compose)

We use a **modular compose architecture** for flexibility and fast iteration.

### 📁 Compose Files (`infrastructure/compose/`)

| File                         | Purpose                        | Command        |
| ---------------------------- | ------------------------------ | -------------- |
| `docker-compose.infra.yml`   | Data stores (Kafka, Redis, DB) | `make infra`   |
| `docker-compose.app.yml`     | Pipeline (L1-L6 + API)         | `make app`     |
| `docker-compose.ui.yml`      | Dashboard + Gateway            | `make ui`      |
| `docker-compose.observe.yml` | Prometheus, Grafana            | `make observe` |

### 🚀 Quick Start

```bash
# Full stack
make up

# Just the dashboard (fast rebuild)
make ui

# Stop everything
make down
```

### 📖 More Details

See [compose/README.md](compose/README.md) for the full guide.
