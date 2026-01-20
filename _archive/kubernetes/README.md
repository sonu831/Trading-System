# 🏗️ Kubernetes Infrastructure (GitOps)

This directory contains the declarative infrastructure for the Nifty 50 Trading System, organized for **GitOps**.

## 📉 Simplified Structure ("Flat Base")

We use a simplified Kustomize structure where each layer sits as a single file in the `base/` directory, reducing complexity.

```
infrastructure/kubernetes/
├── base/
│   ├── layer-1.yaml        # Ingestion
│   ├── layer-2.yaml        # Processing + HPA
│   ├── layer-3.yaml        # Storage (Redis/Timescale)
│   ├── layer-4.yaml        # Analysis + HPA
│   ├── layer-5.yaml        # Aggregation
│   ├── layer-6.yaml        # Signal
│   ├── layer-7.yaml        # Presentation (API/Dash/Bot)
│   ├── observability.yaml  # Prom + Grafana + OTEL
│   └── kustomization.yaml  # Entry point (Mounts Monitoring Configs)
├── overlays/
│   └── dev/                # Environment specifics
└── ../monitoring/          # Config Source (Dashboards/Alerts)
```

## 🔄 GitOps Workflow

```mermaid
graph TD
    subgraph GitOps_Flow
        Base[Base Config] -->|Inherits| Dev[Overlay: Dev]
        Base -->|Inherits| Prod[Overlay: Prod (Future)]
    end

    subgraph Cluster_Resources
        Dev -->|Deploys| L1[Layer 1 Ingestion]
        Dev -->|Deploys| L2[Layer 2 Processing]
        Dev -->|Deploys| HPA[Auto-Scalers]
        Dev -->|Deploys| Obs[Observability Stack]
    end
```

## 🚀 How to Deploy

### 1. Dry Run (Verify YAML)

```bash
kubectl kustomize infrastructure/kubernetes/overlays/dev
```

### 2. Apply to Cluster

```bash
kubectl apply -k infrastructure/kubernetes/overlays/dev
```

## 📊 Auto-Scaling Policies (HPA)

| Service                  | Min Pods | Max Pods | Scale Trigger |
| ------------------------ | -------- | -------- | ------------- |
| **Layer 2 (Processing)** | 2        | 10       | CPU > 70%     |
| **Layer 4 (Analysis)**   | 5        | 20       | CPU > 60%     |
| **Layer 7 (API)**        | 2        | 5        | CPU > 70%     |
