# ===========================================================
# 🚀 Nifty 50 Trading System - Makefile
# ===========================================================
#
# Quick Reference:
#   make up          - Start full stack (Infra + App + UI + Notify)
#   make down        - Stop everything (with Auto-Backup)
#   make dev-nodb    - Restart apps only (Keep DB/Kafka running)
#   make logs        - Tail all container logs
#   make help        - Show all commands
#
# ===========================================================

.PHONY: help up down infra wait-kafka app ui observe logs clean backup restore

COMPOSE_DIR := infrastructure/compose
DC := docker compose --project-name trading-system --env-file .env

# Ensure shared network exists (cross-project)
NETWORK_NAME := local-trading-network
define ensure_network
	@if ! docker network inspect $(NETWORK_NAME) >/dev/null 2>&1; then \
		echo "🌐 Creating shared network: $(NETWORK_NAME)"; \
		docker network create $(NETWORK_NAME); \
	fi
endef

# ===========================================================
# 1. HELP
# ===========================================================

help:
	@echo "🚀 Nifty 50 Trading System"
	@echo ""
	@echo "📦 LIFECYCLE (Docker)"
	@echo "  make up             Start core pipeline (backend + ingestion + dashboard)"
	@echo "  make up-all         Start EVERYTHING (observer, notify, AI, execution)"
	@echo "  make down           Stop everything (Auto-Backup)"
	@echo "  make dev-nodb       Restart Apps (Keep DB/Kafka running)"
	@echo "  make stop-all       Force Stop (Skip Backup)"
	@echo ""
	@echo "🧩 COMPONENTS"
	@echo "  make infra          Start Data Layer (Kafka, Redis, DB)"
	@echo "  make app            Start Full Pipeline (L1-L6 + API + Execution)"
	@echo "  make app-core       Start Core Pipeline (L1 Ingestion + L7 API)"
	@echo "  make ui             Start Dashboard"
	@echo "  make notify         Start Telegram Bot & Email"
	@echo "  make observe        Start Monitoring (Grafana + Prom)"
	@echo "  make ai             Start AI Stack (Inference + Ollama)"
	@echo ""
	@echo "📦 DATABASE & CACHE"
	@echo "  make backup         Backup TimescaleDB to ./backups/"
	@echo "  make restore        Restore from latest backup"
	@echo "  make db-migrate     Apply broker tables migration"
	@echo "  make check-restore  Verify database content"
	@echo "  make check-version  Check TimescaleDB version compatibility"
	@echo "  make db-reset       Full database reset (schema + data)"
	@echo "  make clear-data     Clear candles_1m & data_availability tables"
	@echo "  make redis-clear    Flush all Redis cache"
	@echo ""
	@echo "💻 LOCAL DEV"
	@echo "  make layer[1-7]     Run specific layer locally (npm/go)"
	@echo "  make dev            Start infrastructure for local dev"
	@echo ""
	@echo "🧹 MAINTENANCE"
	@echo "  make logs           Tail logs"
	@echo "  make clean          Remove build artifacts"
	@echo "  make fix-kafka      Fix Kafka Cluster ID issues"
	@echo "  make restart-ingestion  Rebuild & restart ingestion with .env"
	@echo ""

# ===========================================================
# 2. LIFECYCLE MANAGEMENT
# ===========================================================

deploy: app-build ui notify-build
	@echo "✅ Deployment complete!"

up: infra wait-kafka app-core ui
	@echo "🚀 Core pipeline running!"
	@echo ""
	@echo "🌐 Frontend:"
	@echo "   - Dashboard:       http://localhost:3000"
	@echo ""
	@echo "🔌 APIs & Services:"
	@echo "   - Backend API:     http://localhost:4000"
	@echo "   - Ingestion:       http://localhost:9101"
	@echo ""

up-all: infra wait-kafka observe notify app ui ai check-restore
	@echo "🚀 Full stack running!"
	@echo ""
	@echo "🌐 Frontend:"
	@echo "   - Dashboard:       http://localhost:3000"
	@echo "   - Gateway:         http://localhost:8088"
	@echo ""
	@echo "🔌 APIs & Services:"
	@echo "   - Backend API:     http://localhost:4000"
	@echo "   - AI Service:      http://localhost:8000"
	@echo "   - Email Service:   http://localhost:7001"
	@echo "   - Telegram Bot:    http://localhost:7000"
	@echo ""
	@echo "📊 Observability:"
	@echo "   - Grafana:         http://localhost:3001"
	@echo "   - Prometheus:      http://localhost:9090"
	@echo "   - Loki:            http://localhost:3100"
	@echo ""
	@echo "🔧 Infrastructure:"
	@echo "   (Run 'make infra' to see DB/Kafka details)"

down:
	@echo "🔄 Intelligent Shutdown Sequence Initiated..."
	@echo "1️⃣  Cleaning old backups..."
	@make clean-backups
	@echo "2️⃣  Backing up Schema..."
	@make backup-schema
	@echo "3️⃣  Backing up Data..."
	@make backup-data
	@echo "🛑 Stopping all containers..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml down
	@echo "🗑️ Cleaning data folder..."
	@rm -rf data/*
	@echo "✅ Stopped, Backed Up, and Cleaned."

dev-nodb:
	@echo "🔄 Restarting Applications (Keeping DB/Kafka running)..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml down
	@echo "✅ Applications stopped."
	@make app ui notify
	@echo "🚀 Applications restarted!"

stop-all:
	@echo "🛑 FORCE Stopping all containers (Skipping Backup)..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml down
	@echo "✅ Stopped."

# ===========================================================
# 3. COMPONENT MANAGEMENT
# ===========================================================

# Version check for cross-machine compatibility
version-check:
	@echo "🔍 Checking data version compatibility..."
	@if [ -f data/.version ]; then \
		EXPECTED_VERSION=$$(grep -s TIMESCALEDB_VERSION data/.version 2>/dev/null | cut -d= -f2); \
		if [ -z "$$EXPECTED_VERSION" ]; then \
			echo "   No version recorded (legacy data, treating as first run)"; \
		else \
			echo "   Data expects: TimescaleDB $$EXPECTED_VERSION"; \
			echo "   Container has: TimescaleDB 2.24.0"; \
			if [ "$$EXPECTED_VERSION" != "2.24.0" ]; then \
				echo "⚠️  VERSION MISMATCH! Data was created with $$EXPECTED_VERSION"; \
				echo "   Options:"; \
				echo "   1. Run 'make db-reset' to reset database (data loss!)"; \
				echo "   2. Update docker-compose.infra.yml to use version $$EXPECTED_VERSION"; \
				exit 1; \
			fi; \
		fi; \
	else \
		echo "   No version file found (first run or legacy data)"; \
	fi
	@echo "✅ Version check passed!"

infra: version-check
	@echo "🔧 Starting Infrastructure..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d --build
	@echo "⏳ Waiting for TimescaleDB to be ready..."
	@sleep 3
	@echo "📝 Recording TimescaleDB version..."
	@-docker exec timescaledb psql -U trading -d nifty50 -t -c \
		"SELECT installed_version FROM pg_available_extensions WHERE name = 'timescaledb';" 2>/dev/null | \
		tr -d '[:space:]' > data/.tsdb_version 2>/dev/null || true
	@echo "LAST_MACHINE=$$(hostname)" >> data/.version 2>/dev/null || true
	@echo "✅ Infrastructure Running:"
	@echo "   - Kafka:           9092"
	@echo "   - Kafka UI:        http://localhost:8090"
	@echo "   - Redis:           6379"
	@echo "   - Redis Commander: http://localhost:8085"
	@echo "   - TimescaleDB:     5432 (v$$(cat data/timescaledb/.tsdb_version 2>/dev/null || echo 'unknown'))"
	@echo "   - PgAdmin:         http://localhost:5051"

wait-kafka:
	@echo "⏳ Waiting for Kafka to be healthy..."
	@MAX_RETRIES=20; \
	COUNTER=0; \
	until docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1; do \
		COUNTER=$$((COUNTER + 1)); \
		if [ $$COUNTER -ge $$MAX_RETRIES ]; then \
			echo "❌ Kafka failed to become healthy after $$MAX_RETRIES attempts."; \
			echo "💡 Tip: Run 'make fix-kafka' to resolve ClusterID inconsistency errors."; \
			exit 1; \
		fi; \
		echo "   Kafka not ready yet ($$COUNTER/$$MAX_RETRIES), waiting..."; \
		sleep 3; \
	done
	@echo "✅ Kafka is healthy!"

app:
	$(call ensure_network)
	@echo "🚀 Starting Full Pipeline (L1-L6 + API + Execution)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build
	@echo "✅ Full pipeline running."

app-core:
	$(call ensure_network)
	@echo "🚀 Starting Core Pipeline (L1 Ingestion + L2 Processing + L7 API)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build ingestion processing backend-api
	@echo "✅ Core pipeline running."
	@echo "   - Ingestion:  http://localhost:9101"
	@echo "   - Processing: http://localhost:3002"
	@echo "   - Backend API: http://localhost:4000"

app-build:
	$(call ensure_network)
	@echo "🚀 Rebuilding Pipeline..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build
	@echo "✅ Pipeline rebuilt."

ui:
	$(call ensure_network)
	@echo "🖥️  Building Dashboard..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml up -d --build
	@echo "✅ http://localhost:3000"

notify:
	$(call ensure_network)
	@echo "� Starting Notifications..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml up -d --build
	@echo "✅ Telegram Bot & Email Service running"

notify-build:
	$(call ensure_network)
	@echo "🔔 Rebuilding Notifications..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml up -d --build
	echo "✅ Rebuilt Telegram Bot & Email Service"

observe:
	$(call ensure_network)
	@echo "📊 Starting Observability..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml up -d --build
	@echo "✅ Prometheus: 9090 | Grafana: 3001"

gateway:
	$(call ensure_network)
	@echo "🌐 Starting Gateway..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml up -d --build
	@echo "✅ Gateway: http://localhost:8088"

ai:
	@echo "🧠 Starting AI Stack (Inference + Ollama)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d ai-inference ollama
	@echo "✅ AI Services running."

ai-restart:
	@echo "🔄 Restarting AI Stack..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml restart ai-inference ollama
	@echo "✅ AI Services restarted."

ai-logs:
	@$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml logs -f ai-inference ollama

# ===========================================================
# 4. DATABASE OPERATIONS
# ===========================================================

backup:
	@echo "💾 Backing up TimescaleDB (Full)..."
	@if ! docker ps | grep -q timescaledb; then \
		echo "⚠️  TimescaleDB not running. Skipping backup."; \
	else \
		TS=$$(date "+%d-%b-%Y_%I-%M-%S_%p"); \
		DIR="backups/Stock_Market_Live_Data_$$TS"; \
		mkdir -p $$DIR; \
		FILE=$$DIR/Stock_Market_Live_Data.sql; \
		echo "📦 Saving to $$DIR..."; \
		if docker exec timescaledb pg_dump -U trading nifty50 > $$FILE; then \
			if [ -s $$FILE ]; then \
				echo "✅ Backup SAVED & VERIFIED: $$FILE ($$(du -h $$FILE | cut -f1))"; \
			else \
				echo "❌ Backup FAILED: File is empty!"; \
				rm -rf $$DIR; \
				exit 1; \
			fi; \
		else \
			echo "⚠️  Backup command failed."; \
			rm -rf $$DIR; \
			exit 1; \
		fi; \
	fi


backup-data:
	@TS=$$(date "+%d-%b-%Y_%I-%M-%S_%p"); \
	DIR="backups/Stock_Market_Live_Data_DataOnly_$$TS"; \
	mkdir -p $$DIR; \
	FILE=$$DIR/Stock_Market_Live_Data_DataOnly.sql; \
	echo "💾 Backing up TimescaleDB DATA ONLY to $$DIR..."; \
	if docker exec timescaledb pg_dump -U trading nifty50 --data-only > $$FILE; then \
		if [ -s $$FILE ]; then \
			echo "✅ Data Backup SAVED & VERIFIED: $$FILE ($$(du -h $$FILE | cut -f1))"; \
		else \
			echo "❌ Data Backup FAILED: File is empty!"; \
			rm -rf $$DIR; \
			exit 1; \
		fi; \
	else \
		echo "❌ Backup command failed! Removing empty directory..."; \
		rm -rf $$DIR; \
		exit 1; \
	fi

backup-schema:
	@TS=$$(date "+%d-%b-%Y_%I-%M-%S_%p"); \
	DIR="backups/Stock_Market_Live_Data_SchemaOnly_$$TS"; \
	mkdir -p $$DIR; \
	FILE=$$DIR/Stock_Market_Live_Data_SchemaOnly.sql; \
	echo "💾 Backing up TimescaleDB SCHEMA ONLY to $$DIR..."; \
	if docker exec timescaledb pg_dump -U trading nifty50 --schema-only > $$FILE; then \
		if [ -s $$FILE ]; then \
			echo "✅ Schema Backup SAVED & VERIFIED: $$FILE ($$(du -h $$FILE | cut -f1))"; \
		else \
			echo "❌ Schema Backup FAILED: File is empty!"; \
			rm -rf $$DIR; \
			exit 1; \
		fi; \
	else \
		echo "❌ Backup command failed! Removing empty directory..."; \
		rm -rf $$DIR; \
		exit 1; \
	fi

clean-backups:
	@echo "🧹 Cleaning up old backups..."
	@rm -rf backups/*
	@echo "✅ Backups cleaned."

# Reset database for version mismatch recovery
db-reset:
	@echo "⚠️  DATABASE RESET - This will DELETE all TimescaleDB data!"
	@read -p "Are you sure? Type 'yes' to confirm: " confirm && { [ "$$confirm" = "yes" ] || [ "$$confirm" = "y" ]; } || exit 1
	@echo "🛑 Stopping TimescaleDB..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml stop timescaledb
	@echo "🗑️  Deleting data directory..."
	rm -rf data/timescaledb/*
	@echo "🚀 Starting fresh TimescaleDB..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d timescaledb
	@sleep 10
	@echo "📦 Running migrations..."
	@cd layer-3-storage/timescaledb/migrations && \
		for f in *.sql; do \
			echo "  Running $$f..."; \
			docker exec -i timescaledb psql -U trading -d nifty50 < "$$f"; \
		done
	@echo "📝 Creating version file..."
	@echo "TIMESCALEDB_VERSION=2.24.0" > data/.version

# Quick migration for broker tables (after DB container recreation)
db-migrate:
	@echo "📦 Running broker tables migration..."
	@docker exec -i timescaledb psql -U trading -d nifty50 < layer-7-core-interface/api/prisma/migrations/20260709230604_add_broker_provider_registry/migration.sql 2>/dev/null
	@echo "✅ Broker tables ready"
	@echo "POSTGRESQL_VERSION=15" >> data/.version
	@echo "SCHEMA_VERSION=004" >> data/.version
	@echo "CREATED_AT=$$(date +%Y-%m-%d)" >> data/.version
	@echo "LAST_MACHINE=$$(hostname)" >> data/.version
	@echo "✅ Database reset complete!"
	@echo "💡 Run 'make up' to start the full system."

redis-clear:
	@echo "🗑️ Clearing Redis cache..."
	@docker exec redis redis-cli FLUSHALL
	@echo "✅ Redis cache cleared!"

# ───────────────────────────────────────────────────────────────
# clear-data: Clear market data tables (keeps schema intact)
# Use this when you want to re-import data without full db-reset
# Tables cleared: candles_1m, data_availability
# ───────────────────────────────────────────────────────────────
clear-data:
	@echo "🗑️ Clearing market data tables..."
	@docker exec timescaledb psql -U trading -d nifty50 -c "TRUNCATE candles_1m CASCADE;"
	@docker exec timescaledb psql -U trading -d nifty50 -c "TRUNCATE data_availability;"
	@echo "🗑️ Clearing Redis cache..."
	@docker exec redis redis-cli FLUSHALL
	@echo "✅ Data cleared! Tables: candles_1m, data_availability + Redis cache"

restore:
	@echo "📂 Available backups:"
	@find backups -name "*.sql" -maxdepth 2 | sort -r | head -10 || echo "No backups found!"
	@echo ""
	@read -p "Enter backup filepath (or press Enter for latest): " file; \
	if [ -z "$$file" ]; then \
		file=$$(find backups -name "*.sql" -maxdepth 2 | sort -r | head -1); \
	fi; \
	if [ -z "$$file" ]; then \
		echo "❌ No backup file found!"; exit 1; \
	fi; \
	echo "⚠️  WARNING: This will overwite the current database with contents of $$file"; \
	read -p "Are you sure? Type 'y' or 'yes' to confirm: " confirm; \
	if [ "$$confirm" != "y" ] && [ "$$confirm" != "yes" ]; then \
		echo "❌ Restore cancelled."; exit 1; \
	fi; \
	echo "🔄 Restoring from $$file..."; \
	docker exec -i timescaledb psql -U trading nifty50 < $$file; \
	echo "✅ Restore complete!"

check-restore:
	@echo "🔍 Checking if database is empty..."
	@if ! docker exec timescaledb psql -U trading nifty50 -c "SELECT 1 FROM instruments LIMIT 1;" >/dev/null 2>&1; then \
		echo "⚠️  Database appears empty!"; \
		echo "💡 You can restore data using: make restore"; \
		echo "   Or run: make batch (to fetch fresh data)"; \
	else \
		COUNT=$$(docker exec timescaledb psql -U trading nifty50 -t -c "SELECT count(*) FROM instruments;" | tr -d '[:space:]'); \
		echo "✅ Database contains $$COUNT rows in instruments."; \
	fi

version-check-manual:
	@echo "🔍 Checking TimescaleDB version compatibility..."
	@if [ -f data/.version ]; then \
		cat data/.version; \
	else \
		echo "⚠️  No version file found"; \
	fi

# ===========================================================
# 5. DATA & TESTING
# ===========================================================

batch:
	@echo "📊 Fetching historical data..."
	cd layer-1-ingestion && node scripts/batch_nifty50.js

batch-symbol:
	cd layer-1-ingestion && node scripts/batch_nifty50.js --symbol $(SYMBOL)

feed:
	@echo "📡 Feeding data to Kafka..."
	cd layer-1-ingestion && node scripts/feed_kafka.js

# Trigger backfill via Backend API (service must be running)
# Usage: make backfill [SYMBOL=RELIANCE] [FROM=2024-01-01] [TO=2024-12-31]
backfill:
	@echo "📡 Triggering Backfill via Backend API..."
	@curl -s -X POST http://localhost:4000/api/v1/system/backfill/trigger \
		-H "Content-Type: application/json" \
		-d '{"symbol":"$(SYMBOL)","fromDate":"$(FROM)","toDate":"$(TO)"}' | jq .
	@echo "✅ Backfill job queued. Check status with: make backfill-status"

# View data availability status via Backend API
data-status:
	@echo "📊 Data Availability Status..."
	@curl -s http://localhost:4000/api/v1/data/availability | jq '.data.summary'

# View backfill job history
backfill-status:
	@echo "📋 Backfill Jobs..."
	@curl -s http://localhost:4000/api/v1/backfill | jq '.data.jobs[:5]'


test:
	cd layer-1-ingestion && npm test
	cd layer-2-processing && npm test

test-layer1:
	cd layer-1-ingestion && npm test

# ===========================================================
# 6. LOCAL DEVELOPMENT
# ===========================================================
# All layer targets load root .env for DATABASE_URL, REDIS_URL, KAFKA_BROKERS, etc.

dev: infra
	@echo "✅ Dev environment ready. Run layers manually."

layer1:
	@echo "🚀 Starting Layer 1 (Ingestion)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-1-ingestion && npm run dev

layer2:
	@echo "🚀 Starting Layer 2 (Processing)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-2-processing && npm run dev

layer4:
	@echo "🚀 Starting Layer 4 (Analysis)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-4-analysis && go run cmd/main.go

layer5:
	@echo "🚀 Starting Layer 5 (Aggregation)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-5-aggregation && go run cmd/main.go

layer6:
	@echo "🚀 Starting Layer 6 (Signal)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-6-signal && npm run dev

layer7-api:
	@echo "🚀 Starting Layer 7 API (Presentation)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-7-presentation-notification/api && npm run dev

layer7-dashboard:
	@echo "🚀 Starting Layer 7 Dashboard..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-7-presentation-notification/stock-analysis-portal && npm run dev

layer-1-ingestion:
	@echo "🚀 Starting Layer 1 (Ingestion)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-1-ingestion && npm run dev

layer-7-backend-api:
	@echo "🚀 Starting Backend API (Layer 7 Core Interface)..."
	@export $$(cat .env | grep -v '^#' | xargs) && cd layer-7-core-interface/api && npm run dev

# ===========================================================
# 7. OBSERVABILITY & LOGS
# ===========================================================

logs:
	$(DC) logs -f

logs-%:
	$(DC) logs -f $*

# ===========================================================
# 8. MAINTENANCE & CLEANUP
# ===========================================================

clean:
	@echo "🧹 Cleaning..."
	rm -rf layer-*/node_modules layer-*/dist
	@echo "✅ Done."

clean-data:
	@echo "⚠️  Data is stored in data/ directory"
	@echo "   To delete data, you must manually remove files in that directory."
	@echo "   Action aborted for safety."

prune:
	@echo "⚠️  This will delete ALL stopped containers, unused images, and build cache!"
	@read -p "Are you sure? [y/N] " c && [ "$$c" = "y" ] || exit 1
	@echo "🧹 Pruning Docker System..."
	@docker system prune -a --volumes -f
	@echo "✅ Docker Cleaned."

fix-dashboards:
	@echo "🎨 Fixing Grafana dashboards..."
	@python3 scripts/fix-dashboards-final.py
	@docker restart grafana
	@echo "✅ Dashboards fixed and Grafana restarted"
	@echo "� Refresh your browser to see changes"

fix-kafka:
	@echo "🔧 Fixing Kafka Cluster ID (Full Reset)..."
	@$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml stop kafka zookeeper kafka-ui
	@echo "🗑️ Removing containers..."
	@docker rm -f kafka zookeeper kafka-ui || true
	@echo "🗑️ Wiping Kafka data..."
	@rm -rf data/kafka/* || true
	@echo "🗑️ Wiping Zookeeper data..."
	@rm -rf data/zookeeper/* || true
	@echo "🚀 Restarting Kafka Stack..."
	@$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d zookeeper kafka kafka-ui
	@echo "✅ Kafka Stack Reset."
	@echo "⏳ Wait 30s, then check http://localhost:8090"
	@$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml start kafka
	@echo "🚀 Kafka restarted. Check logs with 'make logs'"

# ───────────────────────────────────────────────────────────────
# restart-ingestion: Rebuild and restart ingestion with latest .env
# Use this after changing .env variables like SWARM_CONCURRENCY
# ───────────────────────────────────────────────────────────────
restart-ingestion:
	@echo "🔄 Rebuilding and restarting ingestion..."
	@$(DC) --env-file .env -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build ingestion
	@echo "✅ Ingestion restarted with latest .env values"
	@sleep 3
	@docker logs ingestion --tail 10

# ===========================================================
# 9. SHARING (GATEWAY)
# ===========================================================

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
# 10. AWS & PRODUCTION
# ===========================================================

up-aws:
	@echo "☁️  Starting with AWS Managed Services..."
	@if [ ! -f .env.aws ]; then echo "❌ .env.aws not found! Copy from .env.aws.example"; exit 1; fi
	docker-compose --env-file .env.aws -f docker-compose.aws.yml up -d --build
	@echo "✅ App running with AWS infrastructure!"

down-aws:
	@echo "🛑 Stopping AWS deployment..."
	docker-compose --env-file .env.aws -f docker-compose.aws.yml down
	@echo "✅ Stopped."

up-prod:
	@echo "🚀 Starting Production Stack..."
	docker-compose -f docker-compose.prod.yml up -d --build
	@echo "✅ Production running!"

# ===========================================================
# 11. KNOWLEDGE GRAPH (graphify)
# ===========================================================

GRAPHIFY := uv tool run --from graphifyy graphify

graph:
	@echo "Updating knowledge graph from code changes..."
	$(GRAPHIFY) update .

graph-full:
	@echo "Rebuilding full knowledge graph..."
	$(GRAPHIFY) extract .

graph-query:
	@echo "Usage: make graph-query Q=\"your question\""
	$(GRAPHIFY) query "$(Q)"

graph-open:
	@echo "Open graphify-out/graph.html in your browser"

# ===========================================================
# 12. LEGACY ALIASES
# ===========================================================

docker-up: up
docker-down: down
dashboard: ui
infra-all: infra observe
infra-down: down
