# ===========================================================
# 🚀 Nifty 50 Trading System - Makefile
# ===========================================================
# 
# Quick Reference:
#   make up       - Start full stack (infra + app + ui)
#   make down     - Stop everything
#   make ui       - Rebuild dashboard only (fast!)
#   make logs     - Tail all container logs
#
# ===========================================================

.PHONY: help up down infra app ui observe logs clean

COMPOSE_DIR := infrastructure/compose

# ===========================================================
# HELP
# ===========================================================

help:
	@echo "🚀 Nifty 50 Trading System"
	@echo ""
	@echo "📦 STACKS (Docker)"
	@echo "  make up             Start full stack"
	@echo "  make down           Stop everything"
	@echo "  make infra          Data stores only (Kafka, Redis, DB)"
	@echo "  make app            Pipeline only (L1-L6 + API)"
	@echo "  make ui             Dashboard only (fast rebuild)"
	@echo "  make observe        Monitoring only (Prometheus, Grafana)"
	@echo ""
	@echo "🔧 LOCAL DEVELOPMENT"
	@echo "  make layer1         Run Layer 1 locally (npm)"
	@echo "  make layer2         Run Layer 2 locally (npm)"
	@echo "  make layer4         Run Layer 4 locally (go)"
	@echo "  make dev            Setup dev environment"
	@echo ""
	@echo "📊 DATA & TESTING"
	@echo "  make batch          Fetch historical data (all 50)"
	@echo "  make feed           Feed data to Kafka"
	@echo "  make test           Run all tests"
	@echo ""
	@echo "🌐 SHARING"
	@echo "  make gateway        Start Nginx gateway only"
	@echo "  make share          Expose via public tunnel"
	@echo "  make share-url      Show public URL"
	@echo "  make share-down     Stop gateway and tunnel"
	@echo ""
	@echo "🧹 MAINTENANCE"
	@echo "  make logs           Tail all logs"
	@echo "  make clean          Remove build artifacts"
	@echo "  make clean-data     Delete all data (CAUTION!)"

# ===========================================================
# DOCKER STACKS (Primary Commands)
# ===========================================================

# Common docker-compose options
DC := docker-compose --env-file .env

up: infra app ui
	@echo "🚀 Full stack running!"
	@echo "   Dashboard: http://localhost:3000"
	@echo "   API:       http://localhost:4000"
	@echo "   Grafana:   http://localhost:3001"

down:
	@echo "🛑 Stopping all containers..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml --profile notify --profile flattrade down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml down
	@echo "✅ Stopped."


infra:
	@echo "🔧 Starting Infrastructure..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d
	@echo "✅ Kafka: 9092 | Redis: 6379 | DB: 5432"

app:
	@echo "🚀 Starting Pipeline (L1-L6 + API)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d
	@echo "✅ Pipeline running."

ui:
	@echo "🖥️  Building Dashboard..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml up -d --build
	@echo "✅ http://localhost:3000"

observe:
	@echo "📊 Starting Observability..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml up -d
	@echo "✅ Prometheus: 9090 | Grafana: 3001"

gateway:
	@echo "🌐 Starting Gateway..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml up -d
	@echo "✅ Gateway: http://localhost:8088"

share: up gateway
	@echo "🌐 Public tunnel starting..."
	@sleep 5
	@make share-url

share-url:
	@docker logs trading-tunnel 2>&1 | grep -o 'https://.*trycloudflare.com' || echo "⏳ Tunnel starting... try again in a few seconds"

share-down:
	@echo "🛑 Stopping gateway and tunnel..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml down
	@echo "✅ Stopped."

# ===========================================================
# LOCAL DEVELOPMENT (Run outside Docker)
# ===========================================================

layer1:
	cd layer-1-ingestion && npm run dev

layer2:
	cd layer-2-processing && npm run dev

layer4:
	cd layer-4-analysis && go run cmd/main.go

layer5:
	cd layer-5-aggregation && go run cmd/main.go

layer6:
	cd layer-6-signal && npm run dev

layer7-api:
	cd layer-7-presentation/api && npm run dev

layer7-dashboard:
	cd layer-7-presentation/dashboard && npm run dev

dev: infra
	@echo "✅ Dev environment ready. Run layers manually."

# ===========================================================
# DATA OPERATIONS
# ===========================================================

batch:
	@echo "📊 Fetching historical data..."
	cd layer-1-ingestion && node scripts/batch_nifty50.js

batch-symbol:
	cd layer-1-ingestion && node scripts/batch_nifty50.js --symbol $(SYMBOL)

feed:
	@echo "� Feeding data to Kafka..."
	cd layer-1-ingestion && node scripts/feed_kafka.js

# ===========================================================
# TESTING
# ===========================================================

test:
	cd layer-1-ingestion && npm test
	cd layer-2-processing && npm test

test-layer1:
	cd layer-1-ingestion && npm test

# ===========================================================
# LOGS
# ===========================================================

logs:
	docker-compose logs -f

logs-%:
	docker-compose logs -f $*

# ===========================================================
# CLEANUP
# ===========================================================

clean:
	@echo "🧹 Cleaning..."
	rm -rf layer-*/node_modules layer-*/dist
	@echo "✅ Done."

clean-data:
	@echo "⚠️  This deletes ALL data!"
	@read -p "Continue? [y/N] " c && [ "$$c" = "y" ] || exit 1
	rm -rf data/*
	@echo "✅ Data deleted."


# ===========================================================
# LEGACY ALIASES (for backward compatibility)
# ===========================================================

docker-up: up
docker-down: down
dashboard: ui
infra-all: infra observe
infra-down: down
