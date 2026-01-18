# 🔍 Monitoring Instructions

## 1. Modifying Dashboards (The GitOps Way)

Since we use "Configuration as Code", changes made directly in the Grafana UI will be lost on restart.

**The Correct Workflow:**

1.  Open Grafana [http://localhost:3000](http://localhost:3000).
2.  Edit your dashboard in the UI to get it perfect.
3.  **Click "Save"** icon -> **"Copy JSON"** (or Share -> Export -> View JSON).
4.  Paste the content into `infrastructure/monitoring/grafana/dashboards/system-overview.json`.
5.  Commit to Git.
6.  Deploy updates: `kubectl apply -k infrastructure/kubernetes/overlays/dev`

## 2. Debugging Missing Metrics

If graphs are empty, run these checks:

### Check Collector Logs

```bash
kubectl logs -l app=otel-collector -n nifty50-system
```

_Look for "Connection refused" or "Export failed"._

### Check Prometheus Targets

Open [http://localhost:9090/targets](http://localhost:9090/targets).
_Ensure `otel-collector` state is **UP**._

### Check App Connectivity

Ensure your apps have the env var:

```yaml
OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4317'
```
