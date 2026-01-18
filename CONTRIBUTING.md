# Contributing to Nifty 50 Trading System

Thank you for your interest in contributing! This document provides detailed guidelines to ensure consistency and quality across the project.

## 🏗️ Project Structure & Architecture

This project follows a strict **7-Layer Architecture** to ensure modularity and separation of concerns. Please ensure your code fits into the correct layer:

| Layer  | Directory                           | Responsibility                      | Tech Stack         |
| ------ | ----------------------------------- | ----------------------------------- | ------------------ |
| **L1** | `layer-1-ingestion`                 | Data ingestion & normalization      | Node.js, WebSocket |
| **L2** | `layer-2-processing`                | Stream processing & candle building | Node.js, Kafka     |
| **L3** | `layer-3-storage`                   | Persistence (Hot/Warm/Cold)         | Redis, TimescaleDB |
| **L4** | `layer-4-analysis`                  | Technical analysis engine           | Go (Goroutines)    |
| **L5** | `layer-5-aggregation`               | Market breadth & sector analysis    | Go                 |
| **L6** | `layer-6-signal`                    | Signal decision engine              | Node.js            |
| **L7** | `layer-7-presentation-notification` | Dashboard & Alerts                  | Next.js, Socket.io |

---

## 🚀 Development Workflow

### Branching Strategy

We follow a feature-branch workflow:

1.  **`main`**: Production-ready code.
2.  **`develop`**: Integration branch for next release.
3.  **`feature/name`**: New features (branch off `develop`).
4.  **`fix/name`**: Bug fixes (branch off `develop` or `main` for hotfixes).

### Process

1.  Fork the repository.
2.  Clone your fork: `git clone https://github.com/YOUR_USERNAME/nifty50-trading-system.git`
3.  Create a branch: `git checkout -b feature/amazing-feature`
4.  Make your changes.
5.  Commit changes (see rules below).
6.  Push: `git push origin feature/amazing-feature`
7.  Open a Pull Request against `main`.

---

## 📋 Code Standards

### Node.js (Layers 1, 2, 6, 7)

- **Style**: Use [Prettier](https://prettier.io/) for formatting.
- **Linting**: Follow standard ESLint rules.
- **Modern JS**: Use ES6+ syntax (Async/Await, Arrow functions, Destructuring).
- **Docs**: Add JSDoc comments for all major functions.

### Go (Layers 4, 5)

- **Formatting**: Run `gofmt -s -w .` before committing.
- **Linting**: Use `golangci-lint` to check for issues.
- **Idioms**: Follow effective Go naming conventions and error handling (check `if err != nil`).

---

## 🧪 Testing Guidelines

All new features must include tests.

- **Node.js**: Run `npm test`. Write unit tests using Jest/Mocha.
- **Go**: Run `go test ./...`. Write table-driven tests for logic.

---

## 📝 Commit Messages

We use **Conventional Commits** to automate changelogs and versioning.

Format: `<type>(<scope>): <subject>`

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

**Example:**

> `feat(layer-4): add rsi calculation support`

---

## 🔒 Security

- **Secrets**: NEVER commit `.env` files or hardcode API keys.
- **Dependencies**: Periodically check for vulnerable packages (`npm audit`).

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
