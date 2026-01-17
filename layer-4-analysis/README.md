# Layer 4: Analysis Engine

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview
The core engine that performs parallel technical analysis on all 50 stocks using Go goroutines.

## Technology Stack
- **Language**: Go 1.21+
- **Key Libraries**: `go-redis`, `go-talib`
- **Concurrency**: Goroutines + Channels

## 🚀 How to Run

### Option 1: Docker (Recommended)
```bash
# From project root
docker-compose up -d layer-4-analysis
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
