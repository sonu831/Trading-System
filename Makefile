.PHONY: help up down logs status k8s-dry-run k8s-deploy k8s-delete k8s-status

# Default target
help:
	@echo "🚀 Nifty 50 Trading System Automation"
	@echo ""
	@echo "Local Development (Docker Compose):"
	@echo "  make up          - Build and start all 7 layers + monitoring locally"
	@echo "  make down        - Stop and remove all local containers"
	@echo "  make logs        - Follow logs for all services"
	@echo "  make status      - Check status of local containers"
	@echo ""
	@echo "Kubernetes (GitOps):"
	@echo "  make k8s-dry-run - Preview generated manifests (Kustomize)"
	@echo "  make k8s-deploy  - Deploy entire system to current cluster"
	@echo "  make k8s-delete  - Delete deployment from cluster"
	@echo "  make k8s-status  - Check pods and HPA status"

# ==============================================================================
# Local Development (Docker Compose)
# ==============================================================================
up:
	@echo "🐳 Building and Starting Local System..."
	docker-compose --profile app up --build -d
	@echo "✅ System started!"
	@echo ""
	@echo "🖥️  Web Endpoints:"
	@echo "   - 📈 Dashboard:       http://localhost:3000"
	@echo "   - 📊 Grafana:         http://localhost:3001  (User: admin / Pass: admin123)"
	@echo "   - 🕸️  Kafka UI:        http://localhost:8080"
	@echo "   - 🔴 Redis UI:        http://localhost:8081"
	@echo "   - 🔍 Prometheus:      http://localhost:9090"
	@echo ""
	@echo "🗄️  Database Ports:"
	@echo "   - 🐘 TimescaleDB:     localhost:5432 (User: trading / Pass: trading123 / DB: nifty50)"
	@echo "   - 🔴 Redis:           localhost:6379"

down:
	@echo "🛑 Stopping Local System..."
	docker-compose --profile app down
	@echo "✅ System stopped!"
logs:
	docker-compose logs -f

clean:
	@echo "🧹 Removing Local System and Volumes..."
	docker-compose --profile app down -v
	@echo "✅ System cleaned!"

status:
	docker-compose ps

# ==============================================================================
# Kubernetes Deployment
# ==============================================================================
k8s-dry-run:
	@echo "👀 Generating Kustomize Build Preview..."
	kubectl kustomize --load-restrictor LoadRestrictionsNone infrastructure/kubernetes/overlays/dev

k8s-deploy:
	@echo "🚀 Deploying to Kubernetes..."
	kubectl kustomize --load-restrictor LoadRestrictionsNone infrastructure/kubernetes/overlays/dev | kubectl apply -f -
	@echo "✅ Deployment applied. Watch status with 'make k8s-status'"

k8s-delete:
	@echo "🗑️  Deleting Deployment..."
	kubectl kustomize --load-restrictor LoadRestrictionsNone infrastructure/kubernetes/overlays/dev | kubectl delete -f -

k8s-status:
	@echo "📊 Cluster Status:"
	@echo "--- PODS ---"
	kubectl get pods -n nifty50-system
	@echo ""
	@echo "--- HPA (Auto-Scaling) ---"
	kubectl get hpa -n nifty50-system
