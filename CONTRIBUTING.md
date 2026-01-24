# Contributing to Nifty 50 Trading System

Thank you for your interest in contributing! This document provides comprehensive guidelines and instructions for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Environment](#development-environment)
4. [Project Structure](#project-structure)
5. [Coding Standards](#coding-standards)
6. [Adding New Features](#adding-new-features)
7. [Testing Guidelines](#testing-guidelines)
8. [Submitting Changes](#submitting-changes)
9. [Documentation](#documentation)

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Prioritize the community's best interests

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or insulting comments
- Publishing others' private information
- Any conduct that would be considered unprofessional

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Docker Desktop** installed
- **Git** configured with your GitHub account
- **Node.js 20+** for local development
- **Go 1.23+** for backend services
- **Python 3.11+** for AI service

### Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/Trading-System.git
cd Trading-System

# Add upstream remote
git remote add upstream https://github.com/original-repo/Trading-System.git

# Verify remotes
git remote -v
```

### Branch Naming Convention

```bash
# Feature branches
git checkout -b feature/add-backtesting-engine

# Bug fixes
git checkout -b fix/telegram-bot-crash

# Documentation
git checkout -b docs/update-api-guide

# Refactoring
git checkout -b refactor/layer4-analysis
```

---

## Development Environment

### Quick Setup

```bash
# Start infrastructure only
make infra

# Run specific layer locally
make layer1   # Ingestion
make layer4   # Analysis
make layer7-api   # Core API
```

### Environment Variables

```bash
# Copy example
cp .env.example .env

# Edit with your credentials
nano .env
```

**Required for Development**:

```bash
# Minimal setup for local development
MARKET_DATA_PROVIDER=mstock
AI_PROVIDER=heuristic  # No API keys needed
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
POSTGRES_URL=postgresql://trading:trading123@localhost:5432/nifty50
```

### IDE Setup

**VSCode** (Recommended):

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "go.formatTool": "gofmt",
  "python.formatting.provider": "black",
  "files.eol": "\n"
}
```

**Extensions**:

- ESLint (JavaScript/TypeScript linting)
- Go (Go language support)
- Python (Python language support)
- Docker (Container management)
- Prettier (Code formatting)

---

## Project Structure

This project follows a **9-layer microservices architecture**:

| Layer  | Directory                           | Responsibility              | Tech Stack         |
| ------ | ----------------------------------- | --------------------------- | ------------------ |
| **L1** | `layer-1-ingestion`                 | Data ingestion from brokers | Node.js, WebSocket |
| **L2** | `layer-2-processing`                | Candle aggregation          | Node.js, Kafka     |
| **L3** | `layer-3-storage`                   | Persistence (Hot/Warm)      | Redis, TimescaleDB |
| **L4** | `layer-4-analysis`                  | Technical analysis          | Go                 |
| **L5** | `layer-5-aggregation`               | Market aggregation          | Go                 |
| **L6** | `layer-6-signal`                    | Signal generation           | Node.js            |
| **L7** | `layer-7-core-interface`            | API Gateway                 | Fastify, Socket.io |
| **L8** | `layer-8-presentation-notification` | UI & Notifications          | Telegraf, React    |
| **L9** | `layer-9-ai-service`                | AI/ML Inference             | Python, FastAPI    |

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical specifications.

---

## Coding Standards

### JavaScript/TypeScript

**Style Guide**: Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

**Key Rules**:

```javascript
// ✅ Good: Use const/let, avoid var
const symbolList = ['RELIANCE', 'TCS'];
let currentPrice = 2850.5;

// ✅ Good: Arrow functions
const calculateRSI = (candles, period) => {
  // ...
};

// ✅ Good: Async/await
async function fetchCandles(symbol) {
  try {
    const candles = await db.query('SELECT * FROM candles WHERE symbol = $1', [symbol]);
    return candles;
  } catch (error) {
    logger.error({ symbol, error }, 'Failed to fetch candles');
    throw error;
  }
}
```

**Linting**:

```bash
npm run lint      # Check for issues
npm run lint:fix  # Auto-fix
```

### Go

**Style Guide**: Follow [Effective Go](https://golang.org/doc/effective_go)

**Key Rules**:

```go
// ✅ Good: Proper error handling
func analyzeStock(symbol string) (*Scorecard, error) {
    candles, err := fetchCandles(symbol)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch candles for %s: %w", symbol, err)
    }
    return &Scorecard{Symbol: symbol}, nil
}

// ✅ Good: Use defer for cleanup
func analyzeMarket() error {
    file, err := os.Open("data.csv")
    if err != nil {
        return err
    }
    defer file.Close()
    // Process file...
    return nil
}
```

**Formatting**:

```bash
gofmt -w .              # Format code
go vet ./...            # Check for issues
golangci-lint run       # Run linter
```

### Python

**Style Guide**: Follow [PEP 8](https://pep8.org/)

**Key Rules**:

```python
# ✅ Good: Type hints
def predict(self, features: FeatureVector) -> PredictionResult:
    score = 0.5
    return PredictionResult(prediction=score, confidence=0.8)

# ✅ Good: Docstrings
def calculate_rsi(candles: List[Candle], period: int = 14) -> float:
    """
    Calculate Relative Strength Index.

    Args:
        candles: List of OHLCV candles
        period: RSI period (default: 14)

    Returns:
        RSI value (0-100)
    """
    # ...
```

**Linting**:

```bash
black app/          # Format code
flake8 app/         # Check style
mypy app/           # Type checking
```

---

## Adding New Features

### 1. Adding a New Trading Strategy

**Location**: `layer-6-signal/src/strategies/`

See detailed examples in the full documentation.

### 2. Adding a New AI Provider

**Location**: `layer-9-ai-service/app/engines/`

### 3. Adding a New Telegram Command

**Location**: `layer-8-presentation-notification/telegram-bot/src/bot/commands/`

---

## Testing Guidelines

### Unit Tests

**JavaScript/TypeScript** (Jest):

```bash
cd layer-1-ingestion
npm test                # Run all tests
npm test -- --watch     # Watch mode
npm run test:coverage   # With coverage
```

**Go** (testing package):

```bash
cd layer-4-analysis
go test ./...           # All packages
go test -v ./...        # Verbose
go test -cover ./...    # With coverage
```

**Python** (pytest):

```bash
cd layer-9-ai-service
pytest                  # Run all tests
pytest -v               # Verbose
pytest --cov=app        # With coverage
```

---

## Submitting Changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <description>

# Examples:
git commit -m "feat(layer4): add Bollinger Bands indicator"
git commit -m "fix(telegram): resolve crash on /analyze command"
git commit -m "docs(readme): update installation instructions"
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting)
- `refactor`: Code restructuring
- `test`: Adding/updating tests
- `chore`: Build, dependencies, tooling

### Pull Request Process

1. **Create Feature Branch**
2. **Make Changes** (with tests and docs)
3. **Run Tests**: `make test`
4. **Commit** with conventional commit messages
5. **Push** to your fork
6. **Create Pull Request** on GitHub
7. **Address Code Review** feedback
8. **Merge** (by maintainer after approval)

---

## Documentation

When adding features, update:

- [README.md](README.md) - User-facing documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical specifications
- API Swagger docs (if adding endpoints)

---

## Getting Help

- **Documentation**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Issues**: [GitHub Issues](https://github.com/your-repo/Trading-System/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/Trading-System/discussions)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** 🙏

Every contribution makes this project better for everyone.
