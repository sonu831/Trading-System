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
	@echo "  make up             Start full stack (local infra)"
	@echo "  make down           Stop everything"
	@echo "  make up-aws         Start with AWS managed services"
	@echo "  make down-aws       Stop AWS deployment"
	@echo "  make up-prod        Start production (self-contained)"
	@echo "  make infra          Data stores only (Kafka, Redis, DB)"
	@echo "  make app            Pipeline only (L1-L6 + API)"
	@echo "  make ui             Dashboard only (fast rebuild)"
	@echo "  make notify         Telegram Bot (Guru Ji)"
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
	@echo ""
	@echo "💾 DATABASE"
	@echo "  make backup         Backup TimescaleDB to ./backups/"
	@echo "  make restore        Restore from latest backup"
	@echo ""
	@echo "🔧 TROUBLESHOOTING"
	@echo "  make fix-dashboards Update Grafana dashboards with current container IDs"
	@echo "  make fix-kafka      Fix Kafka cluster ID issues"

# ===========================================================
# DOCKER STACKS (Primary Commands)
# ===========================================================

# Common docker-compose options
DC := docker-compose --env-file .env

up: infra observe notify app ui 
	@echo "🚀 Full stack running!"
	@echo "   Dashboard: http://localhost:3000"
	@echo "   API:       http://localhost:4000"
	@echo "   Grafana:   http://localhost:3001"

	

down:
	@echo "🛑 Stopping all containers..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml down
	@echo "✅ Stopped."

# AWS Managed Services (Stateless Deployment)
up-aws:
	@echo "☁️  Starting with AWS Managed Services..."
	@if [ ! -f .env.aws ]; then echo "❌ .env.aws not found! Copy from .env.aws.example"; exit 1; fi
	docker-compose --env-file .env.aws -f docker-compose.aws.yml up -d --build
	@echo "✅ App running with AWS infrastructure!"
	@echo "   Dashboard: http://localhost:3000"
	@echo "   API:       http://localhost:4000"

down-aws:
	@echo "🛑 Stopping AWS deployment..."
	docker-compose --env-file .env.aws -f docker-compose.aws.yml down
	@echo "✅ Stopped."

# Production (Self-contained)
up-prod:
	@echo "🚀 Starting Production Stack..."
	docker-compose -f docker-compose.prod.yml up -d --build
	@echo "✅ Production running!"


infra:
	@echo "🔧 Starting Infrastructure..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d --build
	@echo "✅ Kafka: 9092 | Redis: 6379 | DB: 5432"

app:
	@echo "🚀 Starting Pipeline (L1-L6 + API)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build
	@echo "✅ Pipeline running."

app-build:
	@echo "🚀 Rebuilding Pipeline..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build
	@echo "✅ Pipeline rebuilt."

ui:
	@echo "🖥️  Building Dashboard..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml up -d --build
	@echo "✅ http://localhost:3000"

observe:
	@echo "📊 Starting Observability..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml up -d --build
	@echo "✅ Prometheus: 9090 | Grafana: 3001"

notify:
	@echo "🔔 Starting Notifications..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml up -d --build
	@echo "✅ Telegram Bot & Email Service running"

notify-build:
	@echo "🔔 Rebuilding Notifications..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml up -d --build
	echo "✅ Rebuilt Telegram Bot & Email Service"

ai:
	@echo "🧠 Starting AI Stack (Inference + Ollama)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d ai-inference ollama
	@echo "✅ AI Services running."

ai-restart:
	@echo "🔄 Restarting AI Stack..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml restart ai-inference ollama
	@echo "✅ AI Services restarted."

ai-logs:
	@docker-compose -f $(COMPOSE_DIR)/docker-compose.app.yml logs -f ai-inference ollama

gateway:
	@echo "🌐 Starting Gateway..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml up -d --build
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
	cd layer-7-presentation-notification/api && npm run dev

layer7-dashboard:
	cd layer-7-presentation-notification/stock-analysis-portal && npm run dev

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

prune:
	@echo "⚠️  This will delete ALL stopped containers, unused images, and build cache!"
	@read -p "Are you sure? [y/N] " c && [ "$$c" = "y" ] || exit 1
	@echo "🧹 Pruning Docker System..."
	@docker system prune -a --volumes -f
	@echo "✅ Docker Cleaned."


# ===========================================================
# DATABASE BACKUP & RESTORE
# ===========================================================

backup:
	@mkdir -p backups
	@echo "💾 Backing up TimescaleDB..."
	@docker exec timescaledb pg_dump -U trading nifty50 > ./backups/nifty50_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup saved to ./backups/"
	@ls -lh backups/*.sql | tail -5

restore:
	@echo "📂 Available backups:"
	@ls -1t backups/*.sql 2>/dev/null | head -10 || echo "No backups found!"
	@echo ""
	@read -p "Enter backup filename (or press Enter for latest): " file; \
	if [ -z "$$file" ]; then \
		file=$$(ls -1t backups/*.sql 2>/dev/null | head -1); \
	fi; \
	if [ -z "$$file" ]; then \
		echo "❌ No backup file found!"; exit 1; \
	fi; \
	echo "🔄 Restoring from $$file..."; \
	docker exec -i timescaledb psql -U trading nifty50 < $$file; \
	echo "✅ Restore complete!"


# ===========================================================
# LEGACY ALIASES (for backward compatibility)
# ===========================================================

docker-up: up
docker-down: down
dashboard: ui
infra-all: infra observe
infra-down: down

# ===========================================================
# TROUBLESHOOTING
# ===========================================================

fix-dashboards:
	@echo "🎨 Fixing Grafana dashboards..."
	@python3 scripts/fix-dashboards-final.py
	@docker restart grafana
	@echo "✅ Dashboards fixed and Grafana restarted"
	@echo "💡 Refresh your browser to see changes"

fix-kafka:
	@echo "🔧 Attempting to fix Kafka Cluster ID..."
	@# 1. Get the Container ID of the kafka service (even if stopped)
	$(eval KAFKA_CONTAINER := $(shell $(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml ps -a -q kafka))
	@if [ -z "$(KAFKA_CONTAINER)" ]; then echo "❌ Kafka container not found. Run 'make infra' first."; exit 1; fi
	@echo "🎯 Found Kafka Container ID: $(KAFKA_CONTAINER)"
	@# 2. Stop Kafka to be safe
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml stop kafka
	@# 3. Run the surgical fix using volumes-from
	docker run --rm --volumes-from $(KAFKA_CONTAINER) alpine rm -f /var/lib/kafka/data/meta.properties
	@echo "✅ meta.properties deleted successfully."
	@# 4. Restart Kafka
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml start kafka
	@echo "🚀 Kafka restarted. Check logs with 'make logs'"
