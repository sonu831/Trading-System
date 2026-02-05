#!/bin/bash
# Extract only DATA (COPY statements) from backup, skipping TimescaleDB internal tables
# This allows restoring data across different TimescaleDB versions

BACKUP_FILE="${1:-backups/nifty50_20260204_130354.sql}"
OUTPUT_FILE="${2:-backups/data_only.sql}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "📦 Extracting data from: $BACKUP_FILE"
echo "📝 Output file: $OUTPUT_FILE"

# Create output file with header
cat > "$OUTPUT_FILE" << 'EOF'
-- Data extracted from backup (TimescaleDB version-agnostic)
-- Only public schema tables, no internal TimescaleDB structures

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;

EOF

# Tables to extract (only public schema, skip _timescaledb_internal)
TABLES=(
    "sectors"
    "plans"
    "system_config"
    "trading_calendar"
    "instruments"
    "user_subscribers"
    "api_keys"
)

for TABLE in "${TABLES[@]}"; do
    echo "  Extracting: $TABLE..."
    
    # Find the COPY statement and extract until \. (end marker)
    awk -v table="$TABLE" '
        /^COPY public\.'"$TABLE"' / { found=1 }
        found { print }
        /^\\.$/ && found { found=0 }
    ' "$BACKUP_FILE" >> "$OUTPUT_FILE"
    
    echo "" >> "$OUTPUT_FILE"
done

echo ""
echo "✅ Data extracted to: $OUTPUT_FILE"
echo ""
echo "📊 Summary:"
wc -l "$OUTPUT_FILE"

echo ""
echo "To restore, run:"
echo "  docker exec -i timescaledb psql -U trading nifty50 < $OUTPUT_FILE"
