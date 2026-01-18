# ===========================================
# Nifty 50 Trading System - Makefile
# ===========================================

.PHONY: help infra infra-down layer1 layer2 batch feed dev test clean logs

# Default target
help:
	@echo "🚀 Nifty 50 Trading System - Available Commands"
	@echo ""
	@echo "📦 INFRASTRUCTURE"
	@echo "  make infra          - Start Kafka, Redis, TimescaleDB"
	@echo "  make infra-all      - Start ALL infrastructure (incl. Prometheus, Grafana)"
	@echo "  make infra-down     - Stop all infrastructure"
	@echo ""
	@echo "🔧 LAYER 1: INGESTION"
	@echo "  make layer1         - Start Layer 1 (npm run dev)"
	@echo "  make layer1-install - Install Layer 1 dependencies"
	@echo "  make batch          - Run Batch Historical Fetch (All 50 stocks)"
	@echo "  make batch-symbol   - Run Batch for single stock (SYMBOL=RELIANCE)"
	@echo "  make feed           - Feed historical data to Kafka"
	@echo ""
	@echo "🏭 LAYER 2: PROCESSING"
	@echo "  make layer2         - Start Layer 2 (npm run dev)"
	@echo "  make layer2-install - Install Layer 2 dependencies"
	@echo ""
	@echo "🐳 DOCKER"
	@echo "  make docker-build   - Build all application Docker images"
	@echo "  make docker-up      - Start full stack (infra + apps)"
	@echo "  make docker-down    - Stop everything"
	@echo ""
	@echo "🧪 TESTING"
	@echo "  make test           - Run all tests"
	@echo "  make test-layer1    - Run Layer 1 tests"
	@echo ""
	@echo "🧹 CLEANUP"
	@echo "  make clean          - Remove node_modules & build artifacts"
	@echo "  make clean-data     - Remove local data (CAUTION: Deletes DB data)"
	@echo ""
	@echo "📊 MONITORING"
	@echo "  make logs           - Tail all container logs"
	@echo "  make logs-kafka     - Tail Kafka logs"
	@echo ""

# ===========================================
# INFRASTRUCTURE
# ===========================================

infra:
	@echo "� Starting Core Infrastructure (Kafka, Redis, TimescaleDB)..."
	docker-compose up -d zookeeper kafka redis timescaledb
	@echo "✅ Infrastructure started!"
	@echo "   Kafka:       localhost:9092"
	@echo "   Redis:       localhost:6379"
	@echo "   TimescaleDB: localhost:5432"

infra-all:
	@echo "🚀 Starting ALL Infrastructure..."
	docker-compose up -d zookeeper kafka redis timescaledb prometheus grafana kafka-ui redis-commander
	@echo "✅ Full infrastructure started!"
	@echo "   Kafka UI:    http://localhost:8080"
	@echo "   Redis UI:    http://localhost:8081"
	@echo "   Grafana:     http://localhost:3001"
	@echo "   Prometheus:  http://localhost:9090"

infra-down:
	@echo "🛑 Stopping infrastructure..."
	docker-compose down
	@echo "✅ Infrastructure stopped."

# ===========================================
# LAYER 1: INGESTION
# ===========================================

layer1:
	@echo "� Starting Layer 1: Ingestion..."
	cd layer-1-ingestion && npm run dev

layer1-install:
	@echo "📦 Installing Layer 1 dependencies..."
	cd layer-1-ingestion && npm install

batch:
	@echo "📊 Running Batch Historical Fetch (All 50 Stocks)..."
	cd layer-1-ingestion && node scripts/batch_nifty50.js

batch-symbol:
	@echo "📊 Running Batch for $(SYMBOL)..."
	cd layer-1-ingestion && node scripts/batch_nifty50.js --symbol $(SYMBOL)

feed: infra
	@echo "Waiting for Kafka to stabilize..."
	sleep 30
	@echo "📤 Feeding Historical Data to Kafka..."
	cd layer-1-ingestion && node scripts/feed_kafka.js

# ===========================================
# LAYER 2: PROCESSING
# ===========================================

layer2:
	@echo "🏭 Starting Layer 2: Processing..."
	cd layer-2-processing && npm run dev

layer2-install:
	@echo "📦 Installing Layer 2 dependencies..."
	cd layer-2-processing && npm install

# ===========================================
# DOCKER (Full Stack)
# ===========================================

docker-build:
	@echo "� Building all Docker images..."
	docker-compose build

docker-up:
	@echo "🐳 Starting full stack..."
	docker-compose --profile app up -d

docker-down:
	@echo "� Stopping all containers..."
	docker-compose down

# ===========================================
# TESTING
# ===========================================

test:
	@echo "🧪 Running all tests..."
	cd layer-1-ingestion && npm test
	cd layer-2-processing && npm test

test-layer1:
	@echo "🧪 Running Layer 1 tests..."
	cd layer-1-ingestion && npm test

test-integration:
	@echo "🧪 Running integration tests..."
	cd layer-1-ingestion && npm run test:integration

# ===========================================
# MONITORING & LOGS
# ===========================================

logs:
	docker-compose logs -f

logs-kafka:
	docker-compose logs -f kafka

logs-layer1:
	docker-compose logs -f ingestion

logs-layer2:
	docker-compose logs -f processing

# ===========================================
# CLEANUP
# ===========================================

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf layer-1-ingestion/node_modules
	rm -rf layer-2-processing/node_modules
	rm -rf layer-1-ingestion/dist
	rm -rf layer-2-processing/dist
	@echo "✅ Cleaned!"

clean-data:
	@echo "⚠️  WARNING: This will delete all local database data!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	rm -rf data/timescaledb/*
	rm -rf data/redis/*
	rm -rf data/kafka/*
	rm -rf data/zookeeper/*
	@echo "✅ Data cleaned!"

# ===========================================
# QUICK SHORTCUTS
# ===========================================

# Start everything needed for development
dev: infra layer1-install layer2-install
	@echo "✅ Development environment ready!"
	@echo "   Run 'make layer1' in Terminal 1"
	@echo "   Run 'make layer2' in Terminal 2"

# Full E2E test flow
e2e: infra
	@echo "⏳ Waiting for infrastructure to be ready..."
	sleep 10
	cd layer-1-ingestion && node scripts/batch_nifty50.js --symbol RELIANCE --days 1
	cd layer-1-ingestion && node scripts/feed_kafka.js
	@echo "✅ E2E test complete! Check TimescaleDB for data."
