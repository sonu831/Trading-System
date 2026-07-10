# Skill: Engineering Standards (architecture + coding discipline)

> Every rule here was written because the opposite **shipped into this repo** and was caught by an audit.
> This is not generic advice. Each section names the real defect.

---

## 0. The three questions before any change

1. **What breaks if this is wrong at 09:20 on expiry day, with a position open?**
2. **How would I know it's wrong — by running something, or by believing a document?**
3. **If a dependency, broker, or feed misbehaves, does this fail *closed* or fail *silently*?**

---

## 1. Execution invariants (money path — non-negotiable)

Enforced in code and asserted by `layer-10-execution/tests/` (`npm run verify`).

| # | Invariant | The bug it prevents |
|---|-----------|---------------------|
| E1 | **Only ever BUY premium.** Bullish → CE, bearish → PE. Never sell to open. | `direction === 'LONG' ? 'BUY' : 'SELL'` would have **sold naked options** (unbounded risk). |
| E2 | **Entry and stop are atomic.** On fill, place a resting SL-M. If it can't be placed, **market-exit immediately**. | Positions sat with no broker-side stop at all. |
| E3 | **The broker is the source of truth.** Open a position only on a *confirmed* fill, at the broker's average fill price. | `await delay(500); // assume filled` invented positions that didn't exist. |
| E4 | **Every order carries a unique `ordertag`.** | Retries double-fired. |
| E5 | **Prices are option premiums, never the index spot.** | `entryPrice` (spot ~25000) was compared to premiums (~₹150) → every position instantly "stop-loss". |
| E6 | **₹P&L = (exit − entry) × lots × lotSize**, sign-neutral to `direction` (we are long premium either way). | Omitting `lotSize` understated risk **75×**; sign-flipping PE inverted every bearish trade. |
| E7 | **The kill switch is persisted** (Redis), not in-memory. | A restart silently resumed trading after a daily-loss breaker trip. |
| E8 | **Live fails closed**: `LIVE_TRADING_ARMED` + capability probe + passing invariant tests. | `TRADE_MODE=live` silently ran the *paper* executor and placed **no orders at all**. |

> If you touch `layer-10-execution/`, run `npm run verify` before you claim anything.

---

## 2. Fail closed. Never fall back silently.

A silent fallback converts "your input is malformed" into "the system is mysteriously wrong."

```js
// ❌ SHIPPED. A non-Base32 secret silently produced a valid-LOOKING but wrong 6-digit code.
try { secret = OTPAuth.Secret.fromBase32(clean); }
catch { secret = new OTPAuth.Secret({ buffer: Buffer.from(clean, 'utf8') }); }
// Broker replied "Please enter correct TOTP" -> days lost debugging the clock.

// ✅ Normalise what is genuinely equivalent; THROW on what is not.
const b32 = normalizeBase32Secret(raw); // strips spaces/hyphens/padding, accepts otpauth://
if (!/^[A-Z2-7]+$/.test(b32)) throw new Error('totp_secret is not valid Base32 (A–Z, 2–7)');
```

Rules:
- A capability you cannot provide → **refuse to construct**. (`LiveExecutor` rejects an OMS without
  `supportsRestingStop()` or `getOrderStatus()`.)
- A degraded dependency → **surface it**. `ExecutionService` throws `503 unreachable`; it never returns a
  default state.
- Distinguish *error classes*: a malformed secret is `stage:'totp_secret'`, a rejected code is
  `stage:'verify_totp'`. Collapsing them sends the next engineer to the wrong place.

---

## 3. Never fabricate a value

Unknown ≠ zero. On a trading screen a confident `0` is worse than a blank.

- Render `—` (em dash) for absent data; `0` only for a real zero.
- Return `null`, throw, or use a discriminated union. Never coerce.
- The pre-audit engine reported **₹0 P&L on every trade** — a UI that printed `0` confidently would have
  hidden that bug for weeks.

```ts
type Loaded<T> =
  | { status: 'loading' }
  | { status: 'unreachable'; reason: string }
  | { status: 'stale'; value: T; ageSeconds: number }
  | { status: 'fresh'; value: T };
```

**Stale data must announce itself.** Freshness is a safety property, not a nicety.

---

## 4. Adapters & ports — one wrapper per external system

Every broker/vendor/feed differs. Isolate the difference; keep the internal contract stable.

- **Auth**: one strategy file per broker (`.../broker/strategies/<id>.js`), declaring
  `requiredFields`, `interactiveInputs`, `capabilities`, `ttlSeconds()`, `canAuthenticateUnattended()`.
  The service knows only three outcomes: `connected` | `needs_input` | `error`.
- **Orders**: one `BrokerAdapter` per broker. It **must** expose `supportsRestingStop()` and
  `getOrderStatus()` or it is not eligible for live execution.
- **UI**: organisms never `fetch`. Adapters live in `src/api/*`, behind `src/ports/*` interfaces.

Adding a broker = **add a file + one registry line**. If it requires editing the service, the abstraction is wrong.

Interactive flows are normal, not exceptional: MStock mails an **OTP**, Kite returns a **`request_token`**,
FlatTrade returns a **`request_code`**. Model them as `begin → needs_input → complete`.

> **Never trigger a side effect during a background refresh.** `getOrRefreshToken()` once re-logged-in on every
> cache miss — mailing the operator a real OTP nobody was waiting for. Hence `canAuthenticateUnattended()`.

---

## 5. One source of truth for every constant and contract

- **Cross-layer** constants/enums/types/topics live in `shared/` (rule 3). Never re-declare locally.
- Generate types from the Fastify JSON schemas rather than hand-copying — drift then fails `tsc`, not production.
- A port number, URL, or key format must exist in **exactly one place**.

Real incident: the execution port lived in four places (`Dockerfile`, compose `PORT`, `config/default.js`, the
L7 `EXECUTION_URL` default). They disagreed. Symptom: the dashboard showed **`ENGINE OFFLINE`** and nothing else.
(`8090` is Kafka UI; execution is **8095**.)

---

## 6. Library correctness (things that look right and aren't)

| Trap | Reality |
|------|---------|
| `redis.set(k, v, 'EX', ttl)` | **ioredis** syntax. node-redis v4 takes an **object**: `{ EX: ttl }`. Positional args are silently dropped → the key **never expires**. |
| Using one Redis client for pub/sub + commands | node-redis v4 requires `client.duplicate()` for `subscribe()`. Commands on a subscribed client **throw** → crash at startup. |
| Fastify `response: { 200: { data: { type: 'object' } } }` | The serializer **strips every key**. Clients receive `data: {}`. Use `additionalProperties: true`. |
| Broker responses are objects | Noren `OrderBook`/`SingleOrdHist` return **arrays** on success. `res.data.stat !== 'Ok'` threw on every successful list call. |
| Status strings are canonical | Noren says `"REJECT"`, not `"REJECTED"`; `"Open"`, not `"OPEN"`. Normalise, or a rejected order looks *pending* until the poll times out. |
| `require('./strategies')` | Node resolves **`strategies.js` before `strategies/index.js`**. A stray sibling file silently shadows a whole directory. Never let both exist. |

---

## 7. Time, clocks and sessions

- All trading-session logic (cutoffs, square-off, expiry roll, daily counters) uses **IST helpers**, never the
  host clock's local zone. Mixing UTC and IST date keys silently split the daily risk counters.
- **Token lifetimes are broker policy, not a guess.** MStock dies at IST midnight; Kite/FlatTrade around
  06:00 IST. A fixed `21000s` TTL either re-logs-in needlessly or serves a token the broker already killed.
- TOTP is time-based: a >30 s clock skew breaks it. Containers on Windows/WSL2 drift after sleep. When a code is
  rejected, report `serverTimeUtc` so skew is diagnosable.

---

## 8. Hot-path discipline (HFT *engineering*, not HFT *claims*)

**Be honest about the ceiling.** Through retail broker REST APIs the floor is **~100–200 ms tick→fill**,
dominated by the broker's match engine. We are **not** competing with colocated HFT and must never imply we are.
The owner has explicitly accepted this lag; the event-driven pipeline is the default and the low-latency hot path
is an *optional* upgrade (`OPTIONS_SCALPING_RULES.md`, `MOMENTUM_TRADING_ARCHITECTURE.md` §2.1).

What we *do* adopt is HFT-grade discipline, because it buys **consistency** (no 2-second outliers) and
**slippage control** — which is where retail money is actually lost:

- **The hot path does no synchronous I/O.** No `fs`, no `require()`, no logging, no DB, no Kafka flush on the
  tick handler. Journal asynchronously *after* the order is on its way.
- **Allocate nothing per tick.** Parse only the fields you use; reuse buffers; avoid closures and `JSON.parse`
  of payloads you discard. Keep the heap small (`--max-old-space-size=256`) so GC pauses stay sub-millisecond.
- **Precompute before the signal fires.** ATM strike map, `tradingsymbol`/token, order payload template and auth
  token are refreshed on a timer — never on demand. Signal → `stringify` → send should be < 1 ms of *our* code.
- **Keep connections warm.** Persistent pool + a keep-alive poll; a cold TLS+DNS handshake costs 100–300 ms.
- **Determinism.** No `Date.now()`/`Math.random()` inside decision logic — inject a clock and a seed, or the
  strategy is neither testable nor replayable.
- **Bounded queues, explicit backpressure.** Never buffer ticks without a limit; drop or coalesce deliberately.
- **Measure or it does not exist.** Stamp every stage with `process.hrtime.bigint()` (tick → decision → sent →
  ack → fill) and track **p50 and p99**, not averages. Regressions live in the tail.
- **Dedicated process.** The scalper never shares a process with the dashboard or API.
- **Exits are broker-side.** A resting SL-M survives our crash; app-side stops do not.

---

## 9. Testing & verification

- **Claims must be executable.** `PROJECT_STATE.md` said `✅ paper/shadow/live modes`; live placed **no orders**
  and paper exited every trade flat on a time-stop. Docs are not evidence. Run it.
- **Test the real function, not a stub of it.** A test that reimplements `generateTOTP` proves nothing about
  `generateTOTP`.
- **When a test fails, decide whether the code or the test is wrong — then say which.** Two "failures" in the
  live-executor suite were an unrealistic mock (a `MKT` order filling at a stale price), not defects.
- **Encode each fixed bug as a named assertion** so it cannot regress silently:
  `'request token NOT cached (the bug that shipped twice)'`.
- Money-path code ships with regression tests: `layer-10-execution/tests/`, `layer-7-core-interface/api/tests/`.

---

## 10. Code style & structure

- **Node**: ESLint + Prettier. **Go**: gofmt + golangci-lint. **Python**: Black + ruff. (rule 8)
- **TypeScript, incrementally, leaf-first** (`allowJs: true`, `strict: true`). Convert `utils` → atoms →
  molecules → organisms → pages. New code is `.ts`/`.tsx` only. CI gate: `tsc --noEmit`.
- **Frontend layering (Atomic Design), enforced by ESLint `no-restricted-imports`** — not by folder names alone:
  `atoms → molecules → organisms → templates → pages`, imports flow one way only.
- **Brand your units.** `type Premium = number & {__brand:'OPTION_PREMIUM'}` makes E5 (spot vs premium)
  a compile error rather than a production loss.
- Comments explain **why**, never what. A comment that restates the code is noise; a comment naming the bug it
  prevents is documentation.
- Never log secrets: no tokens, no TOTP codes, no passwords — not even at `debug`.

---

## 11. Review checklist (paste into the PR)

- [ ] Touches the money path? `cd layer-10-execution && npm run verify` passes.
- [ ] Touches broker auth? `cd layer-7-core-interface/api && npm run verify` passes.
- [ ] Any new fallback — is it *loud*? Any new default — does it fail **closed**?
- [ ] Any value that could be unknown — does it render `—`, not `0`?
- [ ] Any new constant — does it exist in exactly one place (`shared/` if cross-layer)?
- [ ] Any new broker/vendor — is it a **new file + registry line**, with no service edits?
- [ ] Hot path: no sync I/O, no per-tick allocation, no logging?
- [ ] Session logic uses the IST helpers, not the host clock?
- [ ] New behaviour has a named regression assertion.
- [ ] `graphify update .` run after code changes (rule 1).

---

## Hand-off

- None. This document is the standard; enforce it in review and in CI.
