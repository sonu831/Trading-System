# RESTRUCTURE_PLAN.md — Production-Grade HFT Platform Audit & Remediation

> **Date:** 2026-07-10 | **67 findings** across 10 categories | **P0: 6 · P1: 14 · P2: 18 · P3: 29**

---

## 0. Executive Summary

The trading system has strong architectural foundations (event-driven, CQRS, adapter pattern) but gaps in **safety, reliability, and production readiness**. The audit found 67 issues: 3 blockers, 3 critical, 23 high. The most urgent: **Kafka auto-commit (data loss)**, **silent `|| 0` fallbacks in money path (hidden losses)**, **zero tests in 4 core layers**, and **live credentials on disk**.

---

## 1. P0 — Fix Immediately (Blocker/Critical)

### 1.1 🔴 Live Secrets on Disk
| ID | File | Issue | Fix |
|----|------|-------|-----|
| S1 | `.env` | MStock API key, password, TOTP seed, master key in plaintext | Move to Docker secrets or encrypted vault only. Remove from `.env`. |
| S2 | `.env` | `CREDENTIAL_MASTER_KEY` present — all DB credentials decryptable | Same as above. |

### 1.2 🔴 Kafka Consumers Use Auto-Commit (Data Loss)
| ID | File | Issue | Fix |
|----|------|-------|-----|
| K1 | `layer-2-processing/src/kafka/consumer.js` | `autoCommit: true` (default) — crashed message permanently lost | Set `autoCommit: false`, call `commitOffsets()` after successful DB write |
| K2 | `layer-10-execution/src/index.js` | Same — trade signals can be silently dropped | Same |
| K3 | `layer-2-processing/src/kafka/optionChainConsumer.js` | Same | Same |

### 1.3 🔴 Zero Tests in 4 Core Layers
| ID | Layer | Fix |
|----|-------|-----|
| T1 | L2 Processing | Test: candle aggregator correctness, gap handling, idempotency |
| T2 | L4 Analysis (Go) | Test: indicator values vs known datasets, benchmark performance |
| T3 | L5 Aggregation (Go) | Test: breadth calculation, sentiment classification |
| T4 | L6 Signal | Test: regime engine classification, strategy evaluation, signal dedup |

### 1.4 🔴 L4/L5 Direct TimescaleDB + Hardcoded Credentials
| ID | File | Issue | Fix |
|----|------|-------|-----|
| C1 | `L4/internal/db/client.go:33` | `postgresql://trading:trading123@localhost:5432/nifty50` — password in compiled Go binary | Remove. L4/L5 should read from Redis only. |
| C2 | `L5/internal/db/client.go:33` | Same pattern | Same. |

---

## 2. P1 — Fix This Week (High)

### 2.1 🔶 Silent `|| 0` Fallbacks in Money Path (Hide Losses)
| ID | File | Line | Current | Fix |
|----|------|------|---------|-----|
| F1 | `live-executor.js` | 256 | `q?.ltp \|\| pos.currentPrice \|\| 0` | Return `null`, don't default to 0 |
| F2 | `paper-executor.js` | 156 | Same pattern | Same |
| F3 | `trade-journal.js` | 17 | `trade.pnl \|\| 0` | `null` — never coerce absent P&L to 0 |
| F4 | `oms/mstock.js` | 88 | `parseFloat(res.lastPrice \|\| 0)` | Return null, throw if quote unavailable |
| F5 | `oms/flattrade.js` | 184 | `parseFloat(res.lp \|\| 0)` | Same |

### 2.2 🔶 Docker Log Rotation
All 13 services need `logging:` blocks:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

### 2.3 🔶 L7 Backend Robustness
| ID | File | Issue | Fix |
|----|------|-------|-----|
| R1 | `plugins/websocket.js` | 4 `catch (_) {}` — socket errors silently dropped | Log at minimum, emit error event |
| R2 | `modules/system/routes.js` | `catch (_) {}` on DB query failures | Log + return structured error |
| R3 | `modules/execution/routes.js` | Same | Log + return structured error |
| R4 | PM2 caching | Code changes not picked up without hard restart | Add PM2 watch mode for source dir |

### 2.4 🔶 L1 Ingestion Producer — Not Idempotent
| ID | File | Issue | Fix |
|----|------|-------|-----|
| P1 | `kafka/producer.js:49` | `idempotent` removed due to single-broker hang | Fix the broker issue or at minimum set `maxInFlightRequests: 1` |

### 2.5 🔶 HTTP Connection Pooling in L1
No `https.Agent` with `keepAlive: true` configured. Every broker API call creates a new TCP+TLS connection.

---

## 3. P2 — Fix This Month (Medium)

### 3.1 🟡 `npm strict-ssl false` in 8 Dockerfiles
Replace with CA cert install script for build stage.

### 3.2 🟡 Kafka Topic Names Not Centralized
Move all 9 topic names to `shared/constants.js`.

### 3.3 🟡 Redis Keys Without TTL
`market-regime:latest` and `system:layer6:metrics` — no expiry. Stale data persists forever.

### 3.4 🟡 Fake HEALTHCHECKs
`telegram-bot` and `email-service` always pass — replace with real endpoint checks.

### 3.5 🟡 No golangci-lint / ruff / black Configs
CI should enforce Go and Python linting.

### 3.6 🟡 `allowAutoTopicCreation: true` in 4 Producers
Topics should be explicitly created.

### 3.7 🟡 No `tini/init` in Dockerfiles
Go services (L4, L5) need tini for proper SIGTERM forwarding.

### 3.8 🟡 L1 VendorManager init() is synchronous
`marketDataVendor.init()` should be `await` (async init now).

---

## 4. P3 — Systematic Improvements (Low)

### 4.1 Multi-Stage Docker Builds
Only 2 of 13 Dockerfiles use multi-stage. Can reduce image sizes.

### 4.2 Unpinned Python Dependencies
`layer-1-flattrade-python/requirements.txt` has no version pins.

### 4.3 Go Dead Code
`layer-4-analysis/internal/ai/client.go:79` — unreachable `return &result, nil` after return.

### 4.4 PM2 Module Caching
Source volume mount + PM2 = stale modules after code change. Need documented restart procedure.

---

## 5. Reference Architecture

### 5.1 Target State
```
┌─────────────────────────────────────────────────────┐
│ CONTROL PLANE (Dashboard → API → DB + Redis bus)    │
│   Providers · Strategies · Risk · Kill Switch       │
└──────────────────────┬──────────────────────────────┘
                       │ config reads + commands
┌──────────────────────▼──────────────────────────────┐
│ DATA PLANE (Kafka pipeline)                         │
│   L1(data in) → L2(candles) → L4(indicators) →      │
│   L5(breadth) → L6(signals) → L10(orders out)      │
│   L3(storage: TimescaleDB writes + Redis reads)     │
└─────────────────────────────────────────────────────┘
```

### 5.2 Non-Negotiable Rules per Layer
| Rule | Applies To | What |
|------|-----------|------|
| Idempotent consumers | L2, L6, L10 | Manual Kafka commits AFTER success |
| Fail-closed | L10 | Never `|| 0` — return null or throw |
| No direct DB | L4, L5 | Redis reads only |
| Secrets in vault | All | Never .env for live creds |
| Test money path | L10, L6 | Named regression assertions |
| One port per concept | All | Constants in shared/ |

---

## 6. Implementation Order

```
Week 1 (P0):  Secrets rotation · Kafka manual commits · L10 || 0 fixes
Week 2 (P1):  Docker log rotation · L4/L5 DB removal · L7 silent catches · L1 idempotent
Week 3 (P1):  Tests for L2/L4/L5/L6 · HTTP pooling · L7 robustness
Week 4 (P2):  Topic centralization · strict-ssl · HEALTHCHECKs · golangci-lint
Week 5 (P2):  tini/init · Linting CI · multi-stage builds
Week 6 (P3):  PM2 caching · dead code · dependency audit
```

---

## 7. Decision Log

| Date | Decision |
|------|----------|
| 2026-07-10 | Audit completed: 67 findings across 10 categories |
| 2026-07-10 | P0: Rotate credentials, fix Kafka commits, fix L10 fallbacks, add tests to L2/L4/L5/L6 |
| 2026-07-10 | P1: Remove L4/L5 direct DB access + hardcoded credentials |
| 2026-07-10 | All Kafka consumers must use manual commits (contract §4) |
| 2026-07-10 | Never coerce absent data to 0 in money path (engineering-standards §13) |

---

## 8. Hand-off

- **DevOps:** Log rotation · TLS certs · golangci-lint CI · HEALTHCHECKs · tini/init
- **Storage:** Remove L4/L5 direct TimescaleDB · Add Redis TTLs
- **Signal/Processing/Analysis:** Tests for L2/L4/L5/L6
- **API Gateway:** Fix silent catches in websocket.js · PM2 caching docs
- **Ingestion:** Idempotent producer · Connection pooling
- **Security:** Credential rotation · secret-scan CI gate
- **Quality:** CI gates for lint/TS/fmt across all 3 languages
