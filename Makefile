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
	docker-compose up --build -d
	@echo "✅ System started! Dashboard: http://localhost:3000"

down:
	@echo "🛑 Stopping Local System..."
	docker-compose down

logs:
	docker-compose logs -f

status:
	docker-compose ps

# ==============================================================================
# Kubernetes Deployment
# ==============================================================================
k8s-dry-run:
	@echo "👀 Generating Kustomize Build Preview..."
	kubectl kustomize infrastructure/kubernetes/overlays/dev

k8s-deploy:
	@echo "🚀 Deploying to Kubernetes..."
	kubectl apply -k infrastructure/kubernetes/overlays/dev
	@echo "✅ Deployment applied. Watch status with 'make k8s-status'"

k8s-delete:
	@echo "🗑️  Deleting Deployment..."
	kubectl delete -k infrastructure/kubernetes/overlays/dev

k8s-status:
	@echo "📊 Cluster Status:"
	@echo "--- PODS ---"
	kubectl get pods -n nifty50-system
	@echo ""
	@echo "--- HPA (Auto-Scaling) ---"
	kubectl get hpa -n nifty50-system
