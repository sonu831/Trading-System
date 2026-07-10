# Engineering Standards — Compliance Audit

> Cross-referencing every rule in `.ai/skills/engineering-standards.md` against actual code.
> Status per rule: ✅ PASS | ⚠️ PARTIAL | ❌ FAIL

---

## §0. Three Questions

| # | Question | Answer |
|---|----------|--------|
| 0.1 | What breaks at 09:20 expiry day? | Kafka auto-commit could lose signals. `|| 0` fallbacks hide losses. L10 doesn't reconcile broker fills. |
| 0.2 | How would I know it's wrong? | **Currently: by believing a document.** L2/L4/L5/L6 have ZERO tests. L10 has 3 tests but not for live mode. |
| 0.3 | Does it fail closed or silently? | Silently. `catch (_) {}` in websocket.js. `|| 0` coerces absent data. TOTP fallback in §2 generates wrong codes. |

**Score: ❌ FAIL (0/3)**

---

## §1. Execution Invariants (E1–E8)

| # | Invariant | Status | Evidence |
|---|-----------|--------|----------|
| E1 | Only BUY premium | ✅ PASS | PaperExecutor + LiveExecutor use CE for LONG, PE for SHORT |
| E2 | Entry+stop atomic | ❌ FAIL | LiveExecutor places entry order but NO resting SL-M placement. No broker-side stop. |
| E3 | Broker is source of truth | ⚠️ PARTIAL | PaperExecutor simulates fills. LiveExecutor uses `await delay(500); // assume filled` |
| E4 | Unique ordertag | ⚠️ PARTIAL | LiveExecutor generates ordertag. OMS doesn't use it for idempotency. |
| E5 | Prices are premiums, not spot | ✅ PASS | StrikeSelector resolves NFO symbols; premiums from quotes |
| E6 | ₹P&L = (exit−entry)×lots×lotSize | ⚠️ PARTIAL | PositionManager uses lot size. Trade journal had `pnl || 0` (FIXED today) |
| E7 | Kill switch persisted in Redis | ✅ PASS | `execution:kill_switch` key persisted + restored on startup |
| E8 | Live fails closed | ✅ PASS | LiveExecutor throws if OMS lacks `supportsRestingStop()` |

**Score: ⚠️ 4/8 PASS, 3 PARTIAL, 1 FAIL (E2 critical)**

---

## §2. Fail Closed — Never Fall Back Silently

| Rule | Status | Evidence |
|------|--------|----------|
| Refuse to construct | ✅ PASS | LiveExecutor rejects MStockOMS (supportsRestingStop=false) |
| Degraded dep → surface it | ✅ PASS | ExecutionService returns 503, not default state |
| Distinguish error classes | ⚠️ PARTIAL | `broker/strategies/mstock.js` returns `stage: 'login' | 'totp_verify'` — good. But TOTP secret fallback silently produces wrong codes (§3 code sample). |
| Silent catch blocks | ❌ FAIL | **4 `catch (_) {}`** in websocket.js. **1 in system/routes.js**. **1 in execution/routes.js**. |

**Score: ⚠️ 2/4 PASS, 1 PARTIAL, 1 FAIL**

---

## §3. Never Fabricate a Value

| Rule | Status | Evidence |
|------|--------|----------|
| Absent → `—` not `0` | ❌ FAIL | **22 instances of `|| 0`** in L10 execution alone. `pnl || 0` hides losses. `ltp || 0` stops surveillance. |
| Return null/throw/discriminated union | ⚠️ PARTIAL | `Loaded<T>` type defined in `shared/types.ts` but not used in any component |
| Stale data announces itself | ⚠️ PARTIAL | `useStaleness` hook exists but not wired to cockpit. `StaleBadge` component exists but only in SafetyBar. |
| Branded types | ❌ FAIL | `Premium`, `Rupees`, `SpotPrice` brands defined in `shared/types.ts` but NEVER used in any file |

**Score: ❌ FAIL (0/4)**

---

## §4. Adapters & Ports

| Rule | Status | Evidence |
|------|--------|----------|
| One strategy file per broker | ✅ PASS | `broker/strategies/mstock.js`, `flattrade.js`, `kite.js`, `indianapi.js` |
| Three outcomes: connected\|needs_input\|error | ✅ PASS | Each strategy returns `status` field |
| BrokerAdapter must expose supportsRestingStop/getOrderStatus | ⚠️ PARTIAL | FlatTradeOMS exports `supportsRestingStop()`. MStockOMS returns FALSE. No `getOrderStatus()` on either. |
| UI: organisms never fetch | ❌ FAIL | `/scalp` page fetches directly. OptionChainGrid fetches. SafetyBar reads Redux. |
| UI: adapters in `src/api/`, behind `src/ports/` | ⚠️ PARTIAL | `src/api/index.ts` and `src/ports/index.ts` created today. Not yet used by organisms. |
| Add broker = add file + registry line | ✅ PASS | Adding to `strategies/` + `STRATEGIES` map in `strategies.js` |

**Score: ⚠️ 3/6 PASS, 2 PARTIAL, 1 FAIL**

---

## §5. One Source of Truth

| Rule | Status | Evidence |
|------|--------|----------|
| Cross-layer constants in shared/ | ⚠️ PARTIAL | `shared/constants.js` has REGIME, SIGNAL, BROKER enums. Kafka topic names NOT in shared. |
| Types generated from Fastify schemas | ❌ FAIL | Fastify schemas exist. No code generation. Types hand-copied in `shared/types.ts`. |
| Port/URL/key in exactly one place | ❌ FAIL | Execution port: Dockerfile (8095), compose (8095), L7 ExecutionService (8090→fixed to 8095), config/default.js (8090). STILL lives in 4 places. |

**Score: ❌ FAIL (0/3)**

---

## §6. Library Correctness

| Trap | Status | Evidence |
|------|--------|----------|
| `redis.set(k,v,'EX',ttl)` vs `{EX:ttl}` | ✅ PASS | L7 BaseService uses `{ EX: ttlSeconds }` (correct for node-redis v4) |
| redis pub/sub needs duplicate client | ✅ PASS | `websocket.js` uses `pubClient.duplicate()` for subscriber |
| Fastify `additionalProperties: true` | ✅ PASS | FIXED — broker schema had this bug, now corrected |
| Broker response format | ⚠️ UNTESTED | MStock/FlatTrade OMS don't have full API compliance tests |
| Status string normalization | ⚠️ UNTESTED | No normalization code found for broker status strings |
| `require('./strategies')` shadowing | ✅ PASS | `strategies.js` is a single file, not a directory with index.js |

**Score: ⚠️ 4/6 PASS**

---

## §7. Time, Clocks, Sessions

| Rule | Status | Evidence |
|------|--------|----------|
| IST helpers for trading logic | ✅ PASS | `utils/time.js` with luxon. SafetyBar uses IST offset. Session clock endpoint uses IST. |
| Token lifetimes = broker policy | ✅ PASS | TTL = seconds to IST midnight (not fixed 21000s). `secondsUntilISTMidnight()` |
| TOTP clock skew | ❌ FAIL | When TOTP rejected, no `serverTimeUtc` reported. Engineer can't diagnose clock drift. |
| Session clock on dashboard | ✅ PASS | SafetyBar shows countdown to entry cutoff and square-off |

**Score: ⚠️ 3/4 PASS, 1 FAIL**

---

## §8. Hot-Path Discipline

| Rule | Status | Evidence |
|------|--------|----------|
| No sync I/O in hot path | ✅ PASS | Tick handler in L1 doesn't do `fs`, `require()`, or DB writes synchronously |
| Allocate nothing per tick | ⚠️ PARTIAL | Tick mappers create new objects per tick. No buffer reuse. |
| Precompute before signal | ❌ FAIL | ATM strike map, order payload template NOT precomputed. Built on demand per signal. |
| Keep connections warm | ❌ FAIL | **No HTTP connection pooling** in L1. No `https.Agent` with `keepAlive`. Cold TLS per request. |
| Determinism | ❌ FAIL | `Math.random()` in L1 base vendor jitter. `Date.now()` in strategy engine. Testability low. |
| Bounded queues, backpressure | ⚠️ PARTIAL | Kafka configured but no explicit backpressure in consumers |
| Measure p50/p99 | ❌ FAIL | No `process.hrtime.bigint()` stamps. No latency histogram per stage. |
| Dedicated process | ✅ PASS | Each layer is a separate container |
| Exits are broker-side | ❌ FAIL | No resting SL-M placement in LiveExecutor. App-side stops only. |

**Score: ❌ FAIL (2/9 PASS)**

---

## §9. Testing & Verification

| Rule | Status | Evidence |
|------|--------|----------|
| Executable claims | ❌ FAIL | PROJECT_STATE.md says phases complete. L2/L4/L5/L6 have ZERO tests. L10 live mode NOT verified. |
| Test real function | ⚠️ PARTIAL | `verify-mstock-session.js` tests the real flow with mocks. Good. But only 2 L7 tests for 53+ files. |
| Encode bug as named assertion | ❌ FAIL | No named regression assertions found for: `|| 0` P&L bug, TOTP non-Base32 bug, PM2 caching bug |
| Money-path regression tests | ⚠️ PARTIAL | L10 has 3 test files. L7 has 2. But no CI pipeline runs them automatically. |

**Score: ❌ FAIL (0/4 PASS)**

---

## §10. Code Style & Structure

| Rule | Status | Evidence |
|------|--------|----------|
| ESLint + Prettier (JS) | ✅ PASS | eslint.config.js, .prettierrc, husky pre-commit hook |
| gofmt + golangci-lint (Go) | ❌ FAIL | gofmt is in lint-staged for some Go files. **No golangci-lint config anywhere.** |
| Black + ruff (Python) | ❌ FAIL | **No config for either tool.** |
| TypeScript incrementally | ⚠️ PARTIAL | tsconfig created today. Atoms converted to TSX. Most code still JS/JSX. |
| Atomic Design with ESLint enforcement | ❌ FAIL | Folders created (`atoms/`, `molecules/`, etc.). **No ESLint import rules enforcing layering.** |
| Branded types | ❌ FAIL | Types defined in `shared/types.ts`. **Never used in any file.** |
| Comments explain why | ⚠️ PARTIAL | Some good comments (mstock.js flow docs). Many `// TODO` without context. |
| Never log secrets | ✅ PASS | TOTP code logging FIXED. No token/password logging in active code. |

**Score: ⚠️ 2/8 PASS**

---

## §11-12. Dashboard Conventions

| Rule | Status | Evidence |
|------|--------|----------|
| No `../../` imports | ⚠️ PARTIAL | Most new code uses `@/`. Old code has `../../` imports in ~15 files. |
| New code is `.ts`/`.tsx` | ⚠️ PARTIAL | Today: atoms, hooks, slice, api, ports converted. Pages still JS. |
| Barrel exports | ✅ PASS | `components/ui/`, `components/trading/`, `components/layout/`, `hooks/` have index files |
| Shared constants not re-declared | ✅ PASS | `shared/constants.js` used by L7 broker module. Dashboard fetches from API. |

**Score: ⚠️ 2/4 PASS**

---

## Overall Compliance Score

| Section | Score | Max | % |
|---------|-------|-----|---|
| §0 Three Questions | 0 | 3 | 0% |
| §1 Execution Invariants | 4 | 8 | 50% |
| §2 Fail Closed | 2 | 4 | 50% |
| §3 Never Fabricate | 0 | 4 | 0% |
| §4 Adapters & Ports | 3 | 6 | 50% |
| §5 One Source of Truth | 0 | 3 | 0% |
| §6 Library Correctness | 4 | 6 | 67% |
| §7 Time/Sessions | 3 | 4 | 75% |
| §8 Hot-Path | 2 | 9 | 22% |
| §9 Testing | 0 | 4 | 0% |
| §10 Code Style | 2 | 8 | 25% |
| §11-12 Dashboard | 2 | 4 | 50% |
| **TOTAL** | **22** | **63** | **35%** |

---

## Top 5 Most Urgent Violations

1. **§1 E2** — No broker-side resting SL-M. A crash leaves positions unprotected.
2. **§3** — 22 `|| 0` fallbacks in L10. Absent P&L renders as 0 (identical to breaking even).
3. **§9** — 4 of 9 core layers have ZERO tests. Claims unverifiable.
4. **§5** — Execution port still lives in 4 places. One typo = ENGINE OFFLINE.
5. **§8** — No HTTP pooling, no precompute, no latency measurement. "Consistency buys slippage control" is just words.
