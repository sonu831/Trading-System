# Layer 5: Aggregation

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview
Aggregates individual stock analysis to form market-level insights (Breadth, Sector Rotation).

## Technology Stack
- **Language**: Go 1.21+
- **Key Libraries**: `go-redis`
- **Focus**: Data Aggregation

## 🚀 How to Run

### Option 1: Docker (Recommended)
```bash
# From project root
docker-compose up -d layer-5-aggregation
```

### Option 2: Local Development
Requires Go 1.21 installed.

```bash
# 1. Download Modules
go mod download

# 2. Run
go run cmd/main.go
```

## Authors
- **Yogendra Singh**
