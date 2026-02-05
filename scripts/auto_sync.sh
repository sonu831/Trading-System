#!/bin/bash

# Configuration
EXTERNAL_DATA_DIR="/Volumes/Yogi-External/personal/trading-data"
LOCAL_BACKUP_BASE="/Users/yogendrasingh/trading-backups"
DB_CONTAINER="timescaledb"
DB_USER="trading"
DB_NAME="nifty50"

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SNAPSHOT_NAME="data_$TIMESTAMP"
DEST_DIR="$LOCAL_BACKUP_BASE/$SNAPSHOT_NAME"

echo "🔄 Starting Auto-Sync at $(date)..."

# 1. Check if External Drive is mounted
if [ ! -d "$EXTERNAL_DATA_DIR" ]; then
    echo "❌ External drive not mounted at $EXTERNAL_DATA_DIR. Skipping sync."
    # Log failure to DB if reachable? No, if drive is missing, DB might be down.
    # But if DB container is running (e.g. on local data? No data is on external).
    # So we simply exit.
    exit 1
fi

# 2. Check if DB Container is running
if ! docker ps | grep -q $DB_CONTAINER; then
    echo "⚠️  Database container not running. Proceeding with file sync only (cannot log to DB)."
    DB_AVAILABLE=0
else
    DB_AVAILABLE=1
fi

# 3. Create Local Backup Directory
mkdir -p "$DEST_DIR"

# 4. Perform Sync (Copy)
START_TIME=$(date +%s)
echo "📦 Copying data from $EXTERNAL_DATA_DIR to $DEST_DIR..."
cp -r "$EXTERNAL_DATA_DIR"/* "$DEST_DIR/"
COPY_STATUS=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 5. Log Result
if [ $COPY_STATUS -eq 0 ]; then
    echo "✅ Sync successful. Saved to $DEST_DIR"
    STATUS="success"
    
    # Prune old backups (Keep last 5)
    echo "🧹 Pruning old backups (keeping last 5)..."
    cd "$LOCAL_BACKUP_BASE" && ls -1t | tail -n +6 | xargs -I {} rm -rf {}
else
    echo "❌ Sync failed."
    STATUS="failed"
fi

# 6. Insert Log into Database
if [ $DB_AVAILABLE -eq 1 ]; then
    echo "📝 Logging to database..."
    docker exec $DB_CONTAINER psql -U $DB_USER $DB_NAME -c "INSERT INTO backup_logs (timestamp, backup_type, status, location, duration_seconds) VALUES (NOW(), 'auto_sync', '$STATUS', '$DEST_DIR', $DURATION);"
else
    echo "⚠️  Database not available. Log skipped."
fi

echo "🏁 Auto-Sync completed."
