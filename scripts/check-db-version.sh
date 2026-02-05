#!/bin/bash
# =========================================================
# Database Version Compatibility Check
# =========================================================
# This script ensures TimescaleDB version matches between
# the container and the data on the external drive.
# =========================================================

set -e

DB_CONTAINER="timescaledb"
DB_USER="trading"
DB_NAME="nifty50"
VERSION_FILE="/Volumes/Yogi-External/personal/trading-data/timescaledb/.tsdb_version"
EXPECTED_VERSION="2.24.0"  # Must match docker-compose.infra.yml

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking TimescaleDB version compatibility..."

# 1. Check if container is running
if ! docker ps | grep -q $DB_CONTAINER; then
    echo -e "${YELLOW}⚠️  Database container not running. Start with: make infra${NC}"
    exit 1
fi

# 2. Get installed version from container
INSTALLED_VERSION=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT installed_version FROM pg_available_extensions WHERE name = 'timescaledb';" 2>/dev/null | tr -d '[:space:]')

if [ -z "$INSTALLED_VERSION" ]; then
    echo -e "${RED}❌ Could not determine TimescaleDB version.${NC}"
    exit 1
fi

echo "   Container version: $INSTALLED_VERSION"
echo "   Expected version:  $EXPECTED_VERSION"

# 3. Check version file on external drive
if [ -f "$VERSION_FILE" ]; then
    DATA_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
    echo "   Data version:      $DATA_VERSION"
    
    if [ "$DATA_VERSION" != "$INSTALLED_VERSION" ]; then
        echo ""
        echo -e "${RED}❌ VERSION MISMATCH DETECTED!${NC}"
        echo ""
        echo "   Your data was created with TimescaleDB $DATA_VERSION"
        echo "   But this machine has TimescaleDB $INSTALLED_VERSION"
        echo ""
        echo "   Options:"
        echo "   1. Use the same version: Update docker-compose.infra.yml to use $DATA_VERSION"
        echo "   2. Fresh start: Delete data folder and restore from SQL backup"
        echo ""
        echo "   Commands:"
        echo "   Option 1: Change image to timescale/timescaledb:$DATA_VERSION-pg15"
        echo "   Option 2: rm -rf /Volumes/Yogi-External/personal/trading-data/timescaledb/*"
        echo "             make infra && make restore"
        exit 1
    fi
else
    echo "   Data version:      (no version file - creating one)"
fi

# 4. Version matches - update/create version file
echo "$INSTALLED_VERSION" > "$VERSION_FILE"
echo -e "${GREEN}✅ Versions match! Database is compatible.${NC}"

# 5. Show quick stats
echo ""
echo "📊 Quick Stats:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT 'Instruments: ' || count(*) FROM instruments;" 2>/dev/null | tr -d '[:space:]'
echo ""
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT 'Candles (1m): ' || count(*) FROM candles_1m;" 2>/dev/null | tr -d '[:space:]'
echo ""
