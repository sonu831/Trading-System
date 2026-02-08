#!/bin/bash
# Wait for Docker containers to be healthy
# Usage: ./wait-for-health.sh container1 container2 ...

for service in "$@"; do
    echo "⏳ Waiting for $service..."
    timeout=120  # Increased for TimescaleDB recovery
    elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if docker inspect --format='{{.State.Health.Status}}' $service 2>/dev/null | grep -q "healthy"; then
            echo "✅ $service is healthy"
            break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    if [ $elapsed -ge $timeout ]; then
        echo "❌ $service failed to become healthy"
        exit 1
    fi
done

echo "✅ All services are healthy"
