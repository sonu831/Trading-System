# Layer Remediation Plan — audited defects, fixes, and verification

> **Method:** every row below is backed by a file:line or a command output. Nothing is inferred from a status
> document (rule 12: *verify by execution, never by document*). Where a layer was **not** audited, it says so
> rather than implying health.
>
> **Standards this enforces:** [`.ai/skills/engineering-standards.md`](../.ai/skills/engineering-standards.md) ·
> rules 11–14 in [`.ai/ai-manifest.json`](../.ai/ai-manifest.json).
> **Audited:** 2026-07-10.

---

## 0. Severity & the honest scoreboard

| Layer | Tests | Verdict |
|-------|-------|---------|
| L1 Ingestion | 2 | 🔴 **Option-chain pipeline cannot work** (wrong URL, wrong key, wrong id, errors swallowed) |
| L2 Processing | **0** | ⚪ Not audited. `CandleAggregator` unverified. |
| L3 Storage | **0** | ⚪ Not audited. |
| L4 Analysis (Go) | **0** | 🟡 `generateMockCandles()` sits in the production package; `calculateTrendScore` incomplete |
| L5 Aggregation (Go) | **0** | ⚪ Not audited beyond `CalculateBreadth()` read |
| L6 Signal | **0** | 🟠 Regime engine + strategy framework — **the brain, entirely untested** |
| L7 Core API | 2 suites · 117 asserts | 🟢 Broker auth + execution proxy verified. Regime module untested. |
| L8 Dashboard | 0 | 🟠 Light theme broken; no layering; polls instead of pushes |
| L9 AI Service | **0** | ⚪ Not audited |
| L10 Execution | 3 suites · 91 asserts | 🟢 Audited + fixed. `live` unproven against a real broker. |
| Infra / Docker | n/a | 🔴 `node_modules` clobbering; 6 images run as **root**; 12/13 contexts lack `.dockerignore` |

**Total executable coverage: 208 assertions, all in L7 + L10.** The signal brain (L6) and every data layer
(L2–L5, L9) have **zero**.

---

## 1. Layer 1 — Ingestion 🔴

### Evidence

```
layer-1-ingestion/src/vendors/option-chain-poller.js:21
  this.baseUrl = 'https://piconnect.flattrade.in/PiConnectTP/REST/GetQuotes';

layer-1-ingestion/src/vendors/flattrade.js:36
  https://piconnect.flattrade.in/PiConnectTP
```
Meanwhile `layer-1-flattrade-python/src/api_helper.py:37`, `layer-7-.../strategies/flattrade.js:3`,
and `layer-10-execution/src/oms/flattrade.js:9` all use **`/PiConnectAPI`**.

### Defects

| # | Defect | Evidence | Impact |
|---|--------|----------|--------|
| L1-1 | **Wrong FlatTrade base URL + a `/REST/` segment that doesn't exist** | poller:21, flattrade.js:36 | Every option-chain request 404s. The chain pipeline has never worked. |
| L1-2 | **`api_key` sent as `jKey`** | poller:140 `&jKey=${this.apiKey}` | `jKey` is the **login token**, not the key. → "Invalid Session Key". Identical to the OMS bug. |
| L1-3 | **Trading symbol sent where FlatTrade wants a numeric contract token** | poller:139 `token: symbol` | `GetQuotes` resolves `token`, not `tsym`. Needs the scrip master / `SearchScrips`. |
| L1-4 | **`Content-Type: text/plain`** | poller:142 | Docs specify `application/json`. |
| L1-5 | **Every error swallowed to `debug`** | poller:148-151, `return null` | 100 % failure looks identical to "market closed". This is *why* the poller was labelled "unverified" instead of "broken". |
| L1-6 | **Expiry computed on host-local time** | poller:107-123 (`getDay()`, `getHours()`) | In a UTC container the weekday and the 12:00 roll cutoff are wrong. Violates standards §7. |
| L1-7 | **22 serial requests every 3 s** | poller:62-72 (11 strikes × CE/PE), `pollIntervalMs 3000` | ≈ 7 req/s, serial. Will trip FlatTrade rate limits. |
| L1-8 | **Credentials + base URL hardcoded from `env`** | poller:19-21 | Should come from the central Broker Session Service (rule 14). |

### Fix
1. Single `FLATTRADE_BASE = https://piconnect.flattrade.in/PiConnectAPI` constant; delete `/REST/`.
2. `jKey` = session token (`FLATTRADE_TOKEN`, later Redis), **never** `api_key`.
3. Inject a `resolveToken(tsym) → token` port. **Fail closed** if absent — do not post a symbol and hope.
4. `Content-Type: application/json`.
5. Errors: count, warn on first failures, expose `stats`; if *every* quote in a poll fails, log `error`.
6. Expiry via IST helpers.
7. Bounded concurrency + configurable interval.

### Verify
`node layer-1-ingestion/tests/verify-flattrade-urls.js` — asserts no `/PiConnectTP`, no `/REST/`, `jKey ≠ api_key`,
JSON content-type, and fail-closed on a missing token resolver.

---

## 2. Layer 2 — Processing ⚪ (0 tests)

`CandleAggregator` was added to fix "ticks written as 1m candles". **Never verified.**

| Risk | Why it matters |
|------|----------------|
| Bucket boundaries | An off-by-one on the minute boundary silently corrupts every downstream indicator. |
| Timezone | If bucketing uses host-local time, candles shift by 5:30 in a UTC container. |
| Idempotency | Rule 4 requires idempotent consumers; a redelivered tick must not double-count volume. |

**Fix:** unit-test `CandleAggregator` with a synthetic tick stream: open/high/low/close/volume, exact minute
boundaries, out-of-order ticks, duplicate ticks, and IST bucketing. **Do this before trusting any backtest.**

---

## 3. Layer 3 — Storage ⚪ (0 tests)

Not audited. Checks owed: hypertable + compression policy present; `ON CONFLICT DO NOTHING` on every insert
(rule 5); migration `005_execution_schema.sql` applied; Redis keys documented (`ltp:{symbol}`,
`market-regime:latest`, `market_view`, `broker:session:{p}`, `execution:*`) — these are consumed across layers and
belong in `shared/` (rule 3).

---

## 4. Layer 4 — Analysis (Go) 🟡 (0 tests)

| # | Defect | Evidence |
|---|--------|----------|
| L4-1 | **Mock data generator inside the production package** | `internal/analyzer/engine.go:609 generateMockCandles()` |
| L4-2 | **`calculateTrendScore` is incomplete** | `engine.go:528` — literal comment `// Price vs VWAP would go here` |
| L4-3 | **`calculateMomentumScore` is crude** | `engine.go:540` — RSI band + MACD sign only; no ATR/volume normalisation |

**Fix:** move `generateMockCandles` into `_test.go` (a mock in prod is one bad `if` away from trading on fake
data). Finish the VWAP term. Add table-driven tests for RSI/MACD/EMA/ATR/VWAP against known fixtures — these
numbers feed breadth, regime, and every signal.

---

## 5. Layer 5 — Aggregation (Go) ⚪ (0 tests)

`CalculateBreadth()` read and looks sane. One edge case: when `Declining == 0`, `AdvanceDecline` is set to
`Advancing` (a count, not a ratio) — a limit-up day yields a "ratio" of 50. It feeds the regime gate
(`advance_decline_ratio > 1.5`), so it is safe in direction but wrong in magnitude. Document or clamp.

**Fix:** table-driven tests for breadth thresholds and sector momentum labels.

---

## 6. Layer 6 — Signal 🟠 (0 tests) — **the highest-risk gap**

The regime engine and the adaptive strategy framework decide *what to trade*. They were written from logic and
**never executed against real candles**. Every downstream claim (backtest, paper results) inherits that
uncertainty.

**Fix (priority after L1):** mirror `layer-10-execution/tests/`:
- `verify-regime.js` — trend/vol/phase classification on fixture candles; `tfAlignment`; `tradeableTiers`.
- `verify-strategy-router.js` — `regimeAffinity` gating; a breakout strategy must **not** fire in `RANGE`.
- `verify-momentum-burst.js` — the §3.6 rules: 1.5×ATR expansion, close in top 25 %, volume ≥ 1.2×, not-extended.

---

## 7. Layer 7 — Core API 🟢

**Verified:** `npm run verify` → broker auth (104) + execution proxy (13).

Remaining: the `regime` module reads `market-regime:latest` and `market_view` from Redis but has **no test**
that those keys match what L5/L6 actually publish. A key rename would silently return `null` forever
(the UI would show "no data", not an error).

**Fix:** contract test asserting the producer's key names — ideally by importing the key constants from `shared/`.

---

## 8. Layer 8 — Dashboard 🟠

Full plan: [`DASHBOARD_ENHANCEMENT_PLAN.md`](DASHBOARD_ENHANCEMENT_PLAN.md).

- **D1 Light theme is broken** — `ui/Card`, `ui/Badge`, `ui/Button` hardcode `#1a1a2e`/`#2a2a3e` in `styled-jsx`
  and ignore both `darkMode:'class'` and `ThemeToggle`.
- **D2 No enforced layering** (Atomic Design + ESLint import rule).
- **D3 Polling** (3 s / 5 s) where socket rooms exist.
- Migrate to TypeScript leaf-first; brand `Premium` vs spot so E5 becomes a compile error.

---

## 9. Layer 9 — AI Service ⚪ (0 tests)

Not audited. Owed: does the backtest use real candles or `generateMockCandles`-style data? Is the option-leg
P&L modelled (BS + slippage/IV-crush) as the architecture requires?

---

## 10. Layer 10 — Execution 🟢

Audited and fixed; 91 assertions (`npm run verify`). Open items:
- `MStockOMS` order endpoints unverified → it declares `supportsRestingStop() === false`, so `LiveExecutor`
  **refuses to construct** with it. Fails closed, by design.
- `LiveExecutor` passes mock-broker invariant tests but has **never placed a real order**.
- `SyntheticQuoteFeed` is selected when no broker key is present (`index.js:90`). Meaningless for evaluating a
  strategy — paper mode must run `QUOTE_SOURCE=broker`.

---

## 11. Infrastructure / Docker 🔴

Measured across all 13 build contexts:

| # | Defect | Contexts |
|---|--------|----------|
| I-1 | **No `.dockerignore`** | 12 of 13 (only `layer-7-core-interface/api` has one) |
| I-2 | **Host `node_modules` inside the build context** + `COPY . .` | `layer-10-execution`, `stock-analysis-portal` |
| I-3 | **Runs as root** | `gateway`, `layer-1-flattrade-python`, `layer-4-analysis`, `layer-5-aggregation`, `email-service`, `layer-9-ai-service` |
| I-4 | **No HEALTHCHECK** | `gateway`, `flattrade-python`, `email-service`, `stock-analysis-portal`, `telegram-bot`, `ai-service` |
| I-5 | **`npm install --only=production`** — deprecated + non-reproducible | every Node image |

**I-2 is not theoretical.** Both contexts now contain a Windows-built `node_modules`; `COPY . .` copies it over
the image's Linux install, so native modules break at runtime. `.dockerignore` fixes it.

**I-5:** every service has a committed `package-lock.json`, so `npm ci --omit=dev` is safe and reproducible.

### Fix
1. `.dockerignore` in every context: `node_modules`, `.git`, `.env*`, `*.md`, `tests`, `coverage`, `.next`, `dist`.
2. `npm ci --omit=dev` in all Node images.
3. Non-root user + `HEALTHCHECK` for the six root images.
4. `scripts/verify-docker-hygiene.mjs` as a CI gate so this cannot regress.

---

## 12. Cross-cutting — what applies everywhere

| Theme | Action |
|-------|--------|
| **Shared constants** (rule 3/14) | Redis key names, Kafka topics, broker base URLs, the execution port → `shared/`. The port already disagreed across four files. |
| **Fail closed** (rule 11) | Kill every `catch → debug → return null`. The chain poller hid a 100 % failure that way. |
| **IST everywhere** (standards §7) | Expiry roll, session cutoffs, daily counters. Host-local time is a latent 5:30 bug. |
| **Executable proof** (rule 12) | Each layer gets a `npm run verify` / `go test` before we trust its output. |

---

## 13. Execution order (what to fix, in what order, and why)

```
P0 — Data correctness & build integrity   ← starting here
  1. L1 option-chain poller + flattrade vendor: URL, jKey, token port, JSON, fail-loud, IST
  2. Docker: .dockerignore everywhere; npm ci; non-root + healthcheck for the 6 root images
  3. scripts/verify-docker-hygiene.mjs + tests/verify-flattrade-urls.js  (gates, so it can't regress)

P1 — The brain, tested
  4. L6: regime + strategy router + momentum-burst rule tests
  5. L2: CandleAggregator tests (bucket boundaries, IST, idempotency)

P2 — Numbers we bet on
  6. L4: move generateMockCandles to _test.go; finish VWAP term; indicator fixture tests
  7. L5: breadth/sector table tests; clamp the A/D edge case
  8. L7: regime-key contract test against shared/ constants

P3 — Surface
  9. L8: light theme, atomic layering, sockets, TypeScript leaf-first
 10. L9: verify the backtest actually models the option leg
```

**Why this order:** L1 first because a broken chain poller makes *every* option analytic, backtest and paper
result meaningless — and it fails silently. Docker second because a build that ships Windows binaries into a
Linux image will waste a day at the worst moment. Then L6, because an untested brain is the one thing that can
lose money while everything else looks green.

---

## 14. Hand-off

- **Now:** P0 items 1–3 (in progress this session).
- **Owner decision:** the FlatTrade `GetQuotes` call needs a `tsym → token` map. Confirm whether the scrip
  master is already synced (`config.mstock.endpoints.scripMaster` exists; FlatTrade has `SearchScrips` + a
  Scrip Master file). Until it exists, the poller must **fail closed**, not post a symbol as a token.
- **Do not** trust any paper/backtest number produced before P0+P1 land.
