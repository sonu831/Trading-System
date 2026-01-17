# Infrastructure & Deployment Instructions

This document details the infrastructure setup for the Nifty 50 Trading System, standardized for both local development and Kubernetes deployment.

## 🏗️ Kubernetes (GitOps Structure)

We use **Kustomize** to manage Kubernetes manifests, allowing us to keep a clean separation between base configurations and environment-specific overlays (GitOps pattern).

### Directory Structure

```text
infrastructure/kubernetes/
├── base/                           # Shared manifests (Don't edit directly for envs)
│   ├── apps/                       # Application layer manifests
│   │   └── layer-4-analysis/       # Example application deployment
│   └── observability/              # Shared observability stack
│       ├── otel-collector/         # Central telemetry collector
│       ├── prometheus/             # Metrics storage
│       └── grafana/                # Visualization
└── overlays/                       # Environment-specific patches
    └── dev/                        # Local development Cluster configuration
```

### How to Deploy (Dev)

To deploy the development environment to your local cluster (e.g., Minikube, Docker Desktop):

```bash
# Preview manifests
kubectl kustomize infrastructure/kubernetes/overlays/dev

# Apply to cluster
kubectl apply -k infrastructure/kubernetes/overlays/dev
```

---

## 🔭 Observability Stack

The system is instrumented using **OpenTelemetry (OTEL)**.

1.  **OTEL Collector**: Runs as a sidecar or daemonset. Receives metrics/traces from apps via OTLP (gRPC: 4317, HTTP: 4318).
2.  **Prometheus**: Scrapes metrics from the OTEL collector on port `8889`.
3.  **Grafana**: Visualizes data from Prometheus. Accessible on port `3000`.

**Configuration**:
- The generic OTEL configuration is located at `infrastructure/monitoring/otel-collector-config.yaml`.

---

## 🐳 Docker & Local Development

All 7 layers have standardized `Dockerfile`s.

### Running Locally (Docker Compose)

To run the entire system locally without Kubernetes:

```bash
# Build all images
docker-compose build

# Start services in background
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Build Standards
- **Node.js**: Uses `node:18-alpine` for small footprint.
- **Go**: Uses multi-stage builds (`golang:1.21-alpine` -> `alpine`) for minimal production images.
