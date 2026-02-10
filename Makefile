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

.PHONY: help up down infra wait-kafka app ui observe logs clean backup restore layer-4-analysis backfill feed-kafka backfill-logs backfill-files db-candle-status

COMPOSE_DIR := infrastructure/compose
DC := docker-compose --env-file .env
DC_INGESTION := $(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml -f $(COMPOSE_DIR)/docker-compose.app.yml -f $(COMPOSE_DIR)/docker-compose.ingestion.yml

# ===========================================================
# 1. HELP
# ===========================================================

.PHONY: help up down infra wait-kafka app ui observe logs clean backup restore layer-4-analysis backfill feed-kafka backfill-logs backfill-files db-candle-status up-ingestion up-dev-standard

help:
	@echo "🚀 Nifty 50 Trading System"
	@echo ""
	@echo "📦 LIFECYCLE (Docker)"
	@echo "  make up             Production mode (all services with resource limits)"
	@echo "  make up-dev         Development mode (minimal resources, no email/telegram/AI)"
	@echo "  make down           Stop everything (Auto-Backup)"
	@echo "  make dev-nodb       Restart Apps (Keep DB/Kafka running)"
	@echo "  make stop-all       Force Stop (Skip Backup)"
	@echo ""
	@echo "🧩 COMPONENTS"
	@echo "  make infra          Start Data Layer (Kafka, Redis, DB)"
	@echo "  make app            Start Pipeline (L1-L6 + API)"
	@echo "  make ui             Start Dashboard"
	@echo "  make notify         Start Telegram Bot & Email"
	@echo "  make observe        Start Monitoring (Grafana + Prom)"
	@echo ""
	@echo "📡 BACKFILL (MStock → JSON → Kafka → DB)"
	@echo "  make backfill FROM=.. TO=..   Full pipeline: fetch from MStock + feed Kafka"
	@echo "  make feed-kafka              Re-feed existing JSON to Kafka (skip fetch)"
	@echo "  make backfill-files          List fetched JSON files + candle counts"
	@echo "  make backfill-logs           Tail ingestion logs (live progress)"
	@echo "  make db-candle-status        Show per-symbol candle count in DB"
	@echo ""
	@echo "📦 DATABASE & CACHE"
	@echo "  make backup         Backup TimescaleDB to ./backups/"
	@echo "  make restore        Restore from latest backup"
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

# ===========================================================
# PHASED STARTUP SEQUENCE
# ===========================================================

# Phase 1: Core Infrastructure (DB, Redis, Zookeeper)
infra-core:
	@echo "🔧 Phase 1: Starting Core Infrastructure..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d timescaledb redis zookeeper pgadmin redis-commander
	@echo "⏳ Waiting for services to be healthy..."
	@./scripts/wait-for-health.sh timescaledb redis zookeeper

# Phase 2: Interactive Data Restore
# Detects both .dump (custom format) and .sql (plain) backups
restore-check:
	@echo "🔍 Phase 2: Checking database..."
	@if ! docker exec timescaledb psql -U trading nifty50 -c "SELECT 1 FROM instruments LIMIT 1;" > /dev/null 2>&1; then \
		echo "⚠️  Database is empty!"; \
		BACKUP_COUNT=$$(find backups -maxdepth 2 \( -name '*.dump' -o -name '*.sql' \) -not -name '*SchemaOnly*' -not -name '*DataOnly*' 2>/dev/null | wc -l | tr -d ' '); \
		if [ "$$BACKUP_COUNT" -gt 0 ]; then \
			LATEST=$$(find backups -maxdepth 2 \( -name '*.dump' -o -name '*.sql' \) -not -name '*SchemaOnly*' -not -name '*DataOnly*' | sort -r | head -1); \
			echo "📦 Found $$BACKUP_COUNT full backup(s). Latest: $$LATEST"; \
			echo ""; \
			read -p "📦 Restore from latest full backup? (y/N): " full_res; \
			if [ "$$full_res" = "y" ] || [ "$$full_res" = "Y" ]; then \
				make restore; \
			fi; \
		else \
			echo "ℹ️  No backups found. Continuing with empty database."; \
			echo "   Schema will be created by init.sql on first run."; \
		fi; \
	else \
		echo "✅ Database has data."; \
	fi

# Phase 3: Kafka
infra-kafka:
	@echo "🔧 Phase 3: Starting Kafka..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d kafka kafka-ui
	@if ! make wait-kafka; then \
		echo ""; \
		echo "⚠️  Kafka failed to start!"; \
		read -p "🔧 Run 'make fix-kafka' to resolve? (y/N): " fix; \
		if [ "$$fix" = "y" ] || [ "$$fix" = "Y" ]; then \
			make fix-kafka; \
			echo "⏳ Retrying Kafka startup..."; \
			$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d kafka kafka-ui; \
			make wait-kafka; \
		else \
			echo "❌ Kafka startup failed. Cannot continue."; \
			exit 1; \
		fi; \
	fi

# Phase 4a: Backend API (creates schema)
app-backend:
	@echo "🔧 Phase 4a: Starting Backend API..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build backend-api
	@echo "⏳ Waiting for schema creation..."
	@sleep 5

# Phase 4b: Processing Layer
app-processing:
	@echo "🔧 Phase 4b: Starting Processing Layer..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build processing

# Phase 4c: Remaining App Services
app-rest:
	@echo "🔧 Phase 4c: Starting Remaining Services..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml up -d --build

# Phase 5: UI & Monitoring
ui-and-observe:
	@echo "🔧 Phase 5: Starting UI & Monitoring..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml up -d --build
	$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml up -d

# Production: Full Stack with Notifications
up: infra-core restore-check infra-kafka app-backend app-processing app-rest ui-and-observe ai gateway notify
	@echo "✅ Production stack running!"
	@echo ""
	@echo "🌐 Available Services:"
	@echo "   - Dashboard:    http://localhost:3000"
	@echo "   - Backend API:  http://localhost:4000"
	@echo "   - Gateway:      http://localhost:8088"
	@echo "   - Grafana:      http://localhost:3001"
	@echo "   - PgAdmin:      http://localhost:5051"
	@echo "   - Kafka UI:     http://localhost:8090"
	@echo ""
	@echo "📧 Notifications: Enabled (Email + Telegram)"

# Development: Interactive Mode (Standard or High-Performance Ingestion)
up-dev:
	@echo "🚀 Starting Development Environment..."
	@echo ""
	@read -p "⚡ Enable HIGH-PERFORMANCE INGESTION MODE? (Max resources for DB/Ingestion, No UI/AI) (y/N): " mode; \
	if [ "$$mode" = "y" ] || [ "$$mode" = "Y" ]; then \
		make up-ingestion; \
	else \
		make up-dev-standard; \
	fi

# Ingestion Mode: Essential Services with BOOSTED Resources
up-ingestion:
	@echo "🚀 Starting High-Performance Ingestion Mode..."
	
	@echo "1️⃣  Starting Core Infra (Redis, Zookeeper)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d redis zookeeper

	@echo "2️⃣  Starting TimescaleDB (OPTIMIZED)..."
	$(DC_INGESTION) up -d timescaledb
	@echo "⏳ Waiting for DB..."
	@sleep 5
	@make restore-check

	@echo "3️⃣  Starting Kafka (No UI)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml up -d kafka
	@echo "⏳ Waiting for Kafka..."
	@sleep 8

	@echo "4️⃣  Starting Applications (Boosted)..."
	@echo "   - Ingestion:  2 vCPU / 4GB RAM"
	@echo "   - Processing: 4 vCPU / 8GB RAM"
	@echo "   - DB:         8 vCPU / 16GB RAM (synchronous_commit=off)"
	@echo "   - Analysis:   2 vCPU / 4GB RAM (For API Queries)"
	$(DC_INGESTION) up -d --build ingestion processing backend-api analysis
	
	@echo ""
	@echo "✅ High-Performance Pipeline Ready!"
	@echo "   Run 'make backfill' to start fetching data."

# Standard Development: All Services Except Notifications
up-dev-standard: infra-core restore-check infra-kafka app-backend app-processing app-rest ui-and-observe ai gateway
	@echo "✅ Development mode running!"
	@echo ""
	@echo "🌐 Available Services:"
	@echo "   - Dashboard:    http://localhost:3000"
	@echo "   - Backend API:  http://localhost:4000"
	@echo "   - Gateway:      http://localhost:8088"
	@echo "   - Grafana:      http://localhost:3001"
	@echo "   - PgAdmin:      http://localhost:5051"
	@echo "   - AI Services:  Running"
	@echo ""
	@echo "📊 Services DISABLED:"
	@echo "   ❌ Email Service"
	@echo "   ❌ Telegram Bot"

down:
	@echo "🔄 Intelligent Shutdown Sequence..."
	@echo "1️⃣  Stopping UI & Monitoring (frees memory)..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.ui.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml down
	@echo "2️⃣  Stopping Gateway & Notifications..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml down
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml down
	@echo "3️⃣  Stopping AI Services..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.ai.yml down
	@echo "4️⃣  Stopping Application Services..."
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.app.yml down
	@echo "5️⃣  Backing up database (more memory available now)..."
	@read -p "📦 Create BACKUP before shutdown? (y/N): " backup_res; \
	if [ "$$backup_res" = "y" ] || [ "$$backup_res" = "Y" ]; then \
		make backup; \
	else \
		echo "⏩ Skipping backup."; \
	fi
	@echo "6️⃣  Stopping Kafka & Message Queue..."
	-docker stop kafka kafka-ui 2>/dev/null || true
	@echo "7️⃣  Stopping Database & Infrastructure (last)..."
	-docker stop timescaledb redis zookeeper pgadmin redis-commander 2>/dev/null || true
	-$(DC) -f $(COMPOSE_DIR)/docker-compose.infra.yml down
	@echo "8️⃣  Preserving data folder..."
	# @rm -rf data/* <-- DISABLED: Preserves database across restarts
	@echo "✅ Shutdown complete! Database stopped last after backup."

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
		EXPECTED_VERSION=$$(grep TIMESCALEDB_VERSION data/.version | cut -d= -f2); \
		CONTAINER_VERSION=$$(docker run --rm timescale/timescaledb:2.24.0-pg15 psql --version 2>/dev/null | head -1 || echo "2.24.0"); \
		echo "   Data expects: TimescaleDB $$EXPECTED_VERSION"; \
		echo "   Container has: TimescaleDB 2.24.0"; \
		if [ "$$EXPECTED_VERSION" != "2.24.0" ]; then \
			echo "⚠️  VERSION MISMATCH! Data was created with $$EXPECTED_VERSION"; \
			echo "   Options:"; \
			echo "   1. Run 'make db-reset' to reset database (data loss!)"; \
			echo "   2. Update docker-compose.infra.yml to use version $$EXPECTED_VERSION"; \
			exit 1; \
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

notify:
	@echo "� Starting Notifications..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml up -d --build
	@echo "✅ Telegram Bot & Email Service running"

notify-build:
	@echo "🔔 Rebuilding Notifications..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.notify.yml up -d --build
	echo "✅ Rebuilt Telegram Bot & Email Service"

observe:
	@echo "📊 Starting Observability..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.observe.yml up -d --build
	@echo "✅ Prometheus: 9090 | Grafana: 3001"

gateway:
	@echo "🌐 Starting Gateway..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.gateway.yml up -d --build
	@echo "✅ Gateway: http://localhost:8088"

ai:
	@echo "🧠 Starting AI Stack (Inference + Ollama)..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.ai.yml up -d --build
	@echo "✅ AI Services running."

ai-restart:
	@echo "🔄 Restarting AI Stack..."
	$(DC) -f $(COMPOSE_DIR)/docker-compose.ai.yml restart
	@echo "✅ AI Services restarted."

ai-logs:
	$(DC) -f $(COMPOSE_DIR)/docker-compose.ai.yml logs -f


# ===========================================================
# 4. DATABASE OPERATIONS
# ===========================================================

# ─── BACKUP ────────────────────────────────────────────────
# Uses pg_dump -Fc (custom format) for reliable TimescaleDB backup.
# Custom format handles hypertable chunks, catalog metadata, and
# continuous aggregates correctly. Supports pg_restore --data-only,
# --schema-only, and parallel restore (-j).
# ───────────────────────────────────────────────────────────

backup:
	@echo "💾 Backing up TimescaleDB (Full - Custom Format)..."
	@if ! docker ps | grep -q timescaledb; then \
		echo "⚠️  TimescaleDB not running. Skipping backup."; \
	else \
		TS=$$(date "+%Y-%m-%d_%H-%M-%S"); \
		DIR="backups/Stock_Market_Live_Data_Full_$$TS"; \
		mkdir -p $$DIR; \
		FILE=$$DIR/Stock_Market_Live_Data_Full.dump; \
		echo "📦 Saving to $$DIR (pg_dump -Fc)..."; \
		if docker exec timescaledb pg_dump -U trading -Fc nifty50 > $$FILE; then \
			if [ -s $$FILE ]; then \
				echo "✅ Backup SAVED & VERIFIED: $$FILE ($$(du -h $$FILE | cut -f1))"; \
				make _cleanup-old-backups PATTERN="Stock_Market_Live_Data_*" KEEP=5; \
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

# Internal helper: clean up old backup directories
_cleanup-old-backups:
	@OLD_COUNT=$$(find backups -name "$(PATTERN)" -type d 2>/dev/null | wc -l | tr -d ' '); \
	if [ $$OLD_COUNT -gt $(KEEP) ]; then \
		echo ""; \
		echo "📊 Found $$OLD_COUNT backups (keeping last $(KEEP))"; \
		find backups -name "$(PATTERN)" -type d | sort | head -n -$(KEEP); \
		echo ""; \
		read -p "❓ Delete old backups? (y/N): " confirm; \
		if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
			find backups -name "$(PATTERN)" -type d | sort | head -n -$(KEEP) | xargs rm -rf; \
			echo "✅ Old backups removed!"; \
		fi; \
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

clean-notifications:
	@echo "🗑️ Cleaning old system notifications..."
	@docker exec timescaledb psql -U trading -d nifty50 -c "DELETE FROM system_notifications WHERE created_at < NOW() - INTERVAL '5 days';"
	@docker exec timescaledb psql -U trading -d nifty50 -c "VACUUM system_notifications;"
	@echo "✅ Old notifications removed (kept last 5 days)"

truncate-notifications:
	@echo "🗑️  TRUNCATING system_notifications (Instant & Clean)..."
	@docker exec timescaledb psql -U trading -d nifty50 -c "TRUNCATE TABLE system_notifications;"
	@docker exec timescaledb psql -U trading -d nifty50 -c "VACUUM system_notifications;"
	@echo "✅ All notifications cleared! Table size is now 0."

# ─── RESTORE ───────────────────────────────────────────────
# Nuclear restore: DROP DB → CREATE DB → pg_restore/psql.
# Supports both .dump (custom format) and .sql (plain SQL).
# TimescaleDB catalog, chunks, and continuous aggregates are
# restored correctly because we restore from the SAME pg_dump
# that created them (no schema/data mismatch).
# ───────────────────────────────────────────────────────────

restore:
	@echo "📂 Available FULL backups (.dump):"
	@find backups -maxdepth 2 -name "*.dump" | sort -r | head -10 || echo "⚠️ No .dump backups found"
	@echo ""
	@read -p "Enter backup filepath (or Enter for latest): " file; \
	if [ -z "$$file" ]; then \
		file=$$(find backups -maxdepth 2 -name "*.dump" | sort -r | head -1); \
	fi; \
	if [ -z "$$file" ]; then \
		echo "❌ No .dump backup found!"; exit 1; \
	fi; \
	echo ""; \
	echo "⚠️  WARNING: This will DROP and RECREATE the nifty50 database!"; \
	echo "   Source: $$file"; \
	echo ""; \
	read -p "Type 'yes' to confirm: " confirm; \
	if [ "$$confirm" != "yes" ]; then \
		echo "❌ Restore cancelled."; exit 1; \
	fi; \
	echo ""; \
	echo "1️⃣  Terminating active connections..."; \
	docker exec timescaledb psql -U trading -d postgres -c \
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nifty50' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true; \
	echo "2️⃣  Dropping database..."; \
	docker exec timescaledb dropdb -U trading --if-exists nifty50; \
	echo "3️⃣  Creating fresh database..."; \
	docker exec timescaledb createdb -U trading nifty50; \
	echo "   Initializing TimescaleDB extension & pre-restore hooks..."; \
	docker exec timescaledb psql -U trading -d nifty50 -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE; SELECT timescaledb_pre_restore();" > /dev/null; \
	echo "4️⃣  Restoring from $$file..."; \
	echo "   Format: Custom (.dump) → using pg_restore"; \
	docker exec -i timescaledb pg_restore -U trading -d nifty50 --no-owner --no-privileges < $$file || true; \
	echo "   Finalizing restore (post-restore hooks)..."; \
	docker exec timescaledb psql -U trading -d nifty50 -c "SELECT timescaledb_post_restore();" > /dev/null; \
	echo "5️⃣  Verifying restore..."; \
	make check-restore; \
	echo ""; \
	echo "✅ Full restore complete!"


check-restore:
	@echo ""
	@echo "╔════════════════════════════════════════════════════════════╗"
	@echo "║          DATABASE HEALTH CHECK                            ║"
	@echo "╚════════════════════════════════════════════════════════════╝"
	@echo ""
	@docker exec timescaledb psql -U trading nifty50 -c " \
		SELECT 'candles_1m' AS table_name, COUNT(*)::text AS rows FROM candles_1m \
		UNION ALL SELECT 'instruments', COUNT(*)::text FROM instruments \
		UNION ALL SELECT 'data_availability', COUNT(*)::text FROM data_availability \
		UNION ALL SELECT 'sectors', COUNT(*)::text FROM sectors \
		UNION ALL SELECT 'system_config', COUNT(*)::text FROM system_config \
		UNION ALL SELECT 'candles_5m (agg)', COUNT(*)::text FROM candles_5m \
		UNION ALL SELECT 'candles_1h (agg)', COUNT(*)::text FROM candles_1h \
		UNION ALL SELECT 'candles_1d (agg)', COUNT(*)::text FROM candles_1d \
		ORDER BY table_name; \
	" 2>&1 || echo "⚠️  Could not query database"
	@echo ""
	@CANDLE_COUNT=$$(docker exec timescaledb psql -U trading nifty50 -t -c "SELECT COUNT(*) FROM candles_1m;" 2>/dev/null | tr -d '[:space:]'); \
	if [ -z "$$CANDLE_COUNT" ] || [ "$$CANDLE_COUNT" = "0" ]; then \
		echo "⚠️  candles_1m is EMPTY!"; \
		echo "   Run 'make restore' to restore from backup"; \
		echo "   Or run 'make batch' to fetch fresh data"; \
	else \
		echo "✅ Database healthy: $$CANDLE_COUNT candles loaded"; \
	fi

version-check-manual:
	@echo "🔍 Checking TimescaleDB version compatibility..."
	@if [ -f data/.version ]; then \
		cat data/.version; \
	else \
		echo "⚠️  No version file found"; \
	fi

# ===========================================================
# 5. BACKFILL & DATA PIPELINE
# ===========================================================
#
# Data flow:
#   MStock API ──→ JSON files (/app/data/historical/) ──→ Kafka (raw-ticks) ──→ Layer 2 ──→ TimescaleDB
#   ├── Step 1: batch_nifty50.js   (fetch from broker API, write JSON)
#   └── Step 2: feed_kafka.js      (read JSON, publish to Kafka topic)
#
# The JSON files persist on host via volume mount (layer-1-ingestion/data:/app/data)
# so if the container restarts between Step 1 and Step 2, you can re-feed without re-fetching.
#
# ===========================================================

# ─── BACKFILL (Full Pipeline: Fetch + Kafka Feed) ────────
# Triggers Layer 1 to run both steps inside the Docker container.
# Step 1: Fetches candles from MStock API → writes JSON to /app/data/historical/
# Step 2: Reads JSON files → publishes each candle to Kafka 'raw-ticks' topic
# Step 3: Layer 2 consumer picks up from Kafka → inserts to TimescaleDB (ON CONFLICT DO NOTHING)
#
# Usage:
#   make backfill FROM=2025-01-01 TO=2025-12-31                  All 50 Nifty symbols
#   make backfill FROM=2025-01-01 TO=2025-12-31 SYMBOL=RELIANCE  Single symbol
#   make backfill FROM=2025-01-01 TO=2025-12-31 FORCE=true       Force re-fetch (ignore cache)
backfill:
	@echo "📡 Triggering Backfill via Layer 1 (Ingestion)..."
	@echo "   FROM=$(FROM) TO=$(TO) SYMBOL=$(SYMBOL) FORCE=$(FORCE)"
	@echo "   Pipeline: MStock API → JSON → Kafka → Layer 2 → TimescaleDB"
	@echo "   Files saved as: <SYMBOL>_ONE_MINUTE_<FROM>_<TO>.json (kept for re-feed)"
	@echo ""
	@docker exec ingestion node -e " \
		const http = require('http'); \
		const data = JSON.stringify({ \
			symbol: '$(SYMBOL)' || undefined, \
			fromDate: '$(FROM)' || undefined, \
			toDate: '$(TO)' || undefined, \
			force: $(if $(FORCE),$(FORCE),false) \
		}); \
		const req = http.request({ \
			hostname: '0.0.0.0', port: 9101, path: '/api/backfill/historical', \
			method: 'POST', \
			headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } \
		}, res => { \
			let d=''; res.on('data',c=>d+=c); res.on('end',()=>console.log(res.statusCode, d)); \
		}); \
		req.write(data); req.end();"
	@echo ""
	@echo "✅ Backfill triggered! Monitor with: make backfill-logs"

# ─── FEED KAFKA (Step 2 only: JSON → Kafka) ──────────────
# Reads existing JSON files from /app/data/historical/ and publishes to Kafka.
# Use this when Step 1 (fetch) already completed but Step 2 didn't run
# (e.g., container restarted between fetch and kafka feed).
#
# Usage:
#   make feed-kafka                  Feed all symbol JSON files to Kafka
#   make feed-kafka SYMBOL=RELIANCE  Feed single symbol to Kafka
feed-kafka:
	@echo "📡 Re-feeding existing JSON data to Kafka (skipping MStock fetch)..."
	@echo "   Source: /app/data/historical/*.json → Kafka 'raw-ticks' topic"
	@echo ""
	@FILE_COUNT=$$(docker exec ingestion node -e " \
		const fs = require('fs'); \
		const files = fs.readdirSync('/app/data/historical/').filter(f => f.endsWith('.json')); \
		console.log(files.length);" 2>/dev/null); \
	if [ "$$FILE_COUNT" = "0" ] || [ -z "$$FILE_COUNT" ]; then \
		echo "❌ No JSON files found in /app/data/historical/"; \
		echo "   Run 'make backfill FROM=... TO=...' first to fetch data from MStock."; \
		exit 1; \
	fi; \
	echo "📁 Found $$FILE_COUNT data files. Starting Kafka feed..."
	@docker exec ingestion node /app/scripts/feed_kafka.js $(if $(SYMBOL),--symbol $(SYMBOL),)
	@echo ""
	@echo "✅ Kafka feed complete! Layer 2 will consume and insert to TimescaleDB."

# ─── BACKFILL CLEANUP ─────────────────────────────────────

# Delete all JSON data files from /app/data/historical/
backfill-clean:
	@echo "🗑️  Clearing all JSON files from /app/data/historical/..."
	@docker exec ingestion node -e " \
		const fs = require('fs'); const dir = '/app/data/historical/'; \
		try { const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); \
		files.forEach(f => fs.unlinkSync(dir + f)); \
		console.log('   Deleted ' + files.length + ' file(s)'); \
		} catch(e) { console.log('   No files to clean'); }"

# ─── BACKFILL MONITORING ─────────────────────────────────

# Tail Layer 1 ingestion logs (live progress of fetch/feed)
backfill-logs:
	@docker logs ingestion --tail 30 -f

# List all fetched JSON data files with candle counts per symbol
backfill-files:
	@echo "📁 Backfill data files (host: layer-1-ingestion/data/historical/):"
	@echo ""
	@docker exec ingestion node -e " \
		const fs = require('fs'); \
		const dir = '/app/data/historical/'; \
		const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort(); \
		let total = 0; \
		for (const f of files) { \
			try { \
				const raw = fs.readFileSync(dir + f, 'utf-8'); \
				const d = JSON.parse(raw); \
				let c = Array.isArray(d) ? d.length : (d.candles ? d.candles.length : Object.keys(d).length); \
				total += c; \
				console.log('  ' + f.padEnd(35) + c.toLocaleString().padStart(10) + ' candles'); \
			} catch(e) { console.log('  ' + f.padEnd(35) + '  (writing...)'); } \
		} \
		console.log(''); \
		console.log('  Total: ' + files.length + ' files, ' + total.toLocaleString() + ' candles');"

# ─── DATA STATUS (via Layer 7 Backend API) ───────────────

# Show data availability summary (symbols, date ranges, gaps)
data-status:
	@echo "📊 Data Availability Status..."
	@curl -s http://localhost:4000/api/v1/data/availability | jq '.data.summary'

# Show recent backfill job history from DB (created by Layer 7 API)
backfill-status:
	@echo "📋 Backfill Jobs (from DB)..."
	@curl -s http://localhost:4000/api/v1/backfill | jq '.data.jobs[:5]'

# Quick DB candle count check per symbol (direct TimescaleDB query)
db-candle-status:
	@echo "📊 Candle count per symbol in TimescaleDB:"
	@docker exec timescaledb psql -U trading -d nifty50 -c " \
		SELECT symbol, count(*) AS total_candles, \
			min(time)::date AS start_date, max(time)::date AS end_date \
		FROM candles_1m GROUP BY symbol ORDER BY symbol;"


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

layer-4-analysis:
	@echo "🚀 Starting Layer 4 (Analysis)..."
	@export GO_ENV=local $$(cat .env | grep -v '^#' | xargs) && cd layer-4-analysis && go mod tidy && go build -o main cmd/main.go && ./main

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
# 11. LEGACY ALIASES
# ===========================================================

docker-up: up
docker-down: down
dashboard: ui
infra-all: infra observe
infra-down: down
