# Simple & Robust Architecture Plan — Broker Connectivity, Layer Boundaries, Hardening

> **What this is:** an architecture review + improvement plan with one goal — make every layer **simple,
> single-purpose, and robust**. Covers: (1) who talks to brokers (live vs off-market), (2) UI-driven broker
> credentials, (3) the MStock adapter, (4) Docker/infra hardening, (5) per-layer simplification.
> **Status:** PLAN — design/decision record. No code changed by this doc.
> **Created:** 2026-07-09
>
> **Read alongside:** [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md) (the trading
> strategy/adaptive framework) and [`OPTIMIZATION_PLAN.md`](../OPTIMIZATION_PLAN.md) (prior infra optimization work).

---

## 0. TL;DR — the decisions

1. **Two broker touchpoints only.** L1 Ingestion owns **all market data** (live WebSocket + historical REST +
   option chain). L10 Execution owns **all orders**. **No other layer ever opens a broker connection.**
2. **In live market, layers do NOT read the socket directly** — they consume L1's normalized `raw-ticks` from
   Kafka. One data gateway. This is simpler *and* more robust than every layer having its own broker socket.
3. **Ingestion is always-on, not just for market-off.** Live hours → WebSocket → `raw-ticks`. Market closed →
   historical backfill. Same layer, same output topic. Its role is not "more evident when market is off" — it's
   the single data gateway at all times.
4. **Credentials move from `.env` to a UI-driven encrypted vault.** Add broker login-id / password / TOTP secret
   / API key from the dashboard; stored encrypted; a shared session-token cache (Redis) serves both L1 and L10.
5. **The adapter pattern already exists and is correct** (`BaseVendor` + `MStockVendor`/`FlatTradeVendor`/…).
   Keep it. The work is *sourcing credentials from the vault* and *centralising the broker session*, not rebuilding.
6. **Harden Docker** — the single most urgent fix: **stop disabling TLS at runtime** (`NODE_TLS_REJECT_UNAUTHORIZED=0`
   in ingestion is a live-credential MITM risk). Plus multi-stage builds, `npm ci`, non-root everywhere, `tini`.

---

## 1. Guiding Principles — "simple & robust"

Every design choice below is judged against five rules. If a change violates one, don't do it.

| # | Principle | Concretely |
|---|-----------|------------|
| P1 | **One job per layer** | A layer does exactly one thing. If you can't say its job in one sentence, it's doing too much. |
| P2 | **One input, one output** | Each layer consumes from **one** Kafka topic and produces to **one** topic. No side-channels, no direct cross-layer calls. |
| P3 | **Brokers touched in exactly two places** | L1 (data in), L10 (orders out). Everywhere else, a broker is invisible. |
| P4 | **Secrets live in a vault, never in code or images** | Env vars are for bootstrap only; real creds come from the encrypted vault. |
| P5 | **Fail loud, recover automatically, never sit unprotected** | Idempotent consumers, auto-reconnect, resting broker-side SL. Robustness ≠ complexity. |

---

## 2. The Big Question — live market: direct socket, or via ingestion?

**Answer: always via ingestion.** Here is why, and why the alternative is the "confusing" trap.

### Option A ❌ — each layer opens its own broker socket in live market
```
Broker WS ──► Scalper (its own socket)
Broker WS ──► Analysis (its own socket)
Broker WS ──► Execution (its own socket)
```
Problems: N reconnect implementations, N rate-limit budgets against the broker, N copies of normalization, N
places to update when a broker changes its API, and **no single source of truth for "the current tick."** This
is exactly the confusion to avoid.

### Option B ✅ — ingestion is the single data gateway (live AND historical)
```
                 ┌──────────────── L1 INGESTION (single data gateway) ────────────────┐
 Broker WS  ───► │ live ticks    ─┐                                                     │
 Broker REST ──► │ historical    ─┼─► normalize (mappers) ─► raw-ticks (Kafka) ─────────┼─► everyone
 Broker REST ──► │ option chain  ─┘                                                     │
                 └──────────────────────────────────────────────────────────────────────┘
        L2 candles ◄─ raw-ticks    L4 analysis ◄─ market_candles    L6 signals ◄─ analysis+regime
        L10 execution ◄─ trade-signals (Kafka)   ── and L10 is the ONLY layer that sends orders back to a broker
```
Benefits (all five principles satisfied): one reconnect/rate-limit/normalization path; one source of truth for
ticks; brokers touched only in L1; adding/replacing a broker changes exactly one layer.

### "But scalping needs speed?"
Per the owner: **lag is acceptable** (we capture 1m–multi-hour moves, not tick edges). So the low-latency
"direct socket bypass" hot path is **explicitly out of scope for v1** — it's the very duplication that makes the
system confusing. If, much later, forward-testing proves T1 scalps are too slow, the hot path is added as an
**L1 concern** (a dedicated fast-feed inside the data gateway), **not** by letting the scalper open its own
socket. The single-gateway rule holds even then.

> **Net simplification:** delete the idea of layers talking to brokers directly. Two gateways, one bus.

---

## 3. Architecture Review — is this correct? (verdict + fixes)

Grounded in the actual code (graphify + reads), not assumptions.

### What is already RIGHT — keep it
| Area | Evidence | Verdict |
|------|----------|---------|
| **Adapter pattern for brokers** | `layer-1-ingestion/src/vendors/`: `BaseVendor` (contract) + `MStockVendor`, `FlatTradeVendor`, `KiteVendor`, `IndianApiVendor`, `CompositeVendor`, `factory.js` | ✅ Correct. Textbook adapter + factory. Do not rebuild. |
| **Failover feed** | `CompositeVendor` | ✅ This is your dual-feed (Zerodha + FlatTrade) mechanism — already exists. |
| **MStock 2-step TOTP auth** | `mstock.js` `authenticate()` (login → verifyTOTP → trading token, auto re-auth on 401) | ✅ Robust and complete. |
| **Event-driven + CQRS** | Kafka topics, Redis reads / TimescaleDB writes | ✅ Sound foundation. |
| **Option-chain poller** | `vendors/option-chain-poller.js` | ✅ The momentum-module data gap is already being filled. |

### What is CONFUSING / RISKY — fix it
| # | Issue | Where | Fix |
|---|-------|-------|-----|
| F1 | **Credentials in `.env` only** — can't add/rotate from UI, plaintext on disk, one shared account | `mstock.js` reads `process.env.MSTOCK_*` directly | Broker Credential Vault (§4) |
| F2 | **Broker session not shared** — each service logs in separately → multiple sessions, extra rate-limit load | `mstock.js` holds token in memory per instance | Central session cache in Redis (§4.3) |
| F3 | **TLS verification disabled at runtime** | `layer-1-ingestion/Dockerfile`: `ENV NODE_TLS_REJECT_UNAUTHORIZED=0` | **Remove** — MITM risk on live creds/orders (§6) |
| F4 | **Secret leaked to logs** | `mstock.js` `logger.info('Generated TOTP Code: ${code}')` | Never log TOTP codes / tokens |
| F5 | **Global `console.error`/`console.log` monkey-patch** | top of `mstock.js` | Replace with proper logger level config — a global patch is fragile and leaks across the process |
| F6 | **Layer boundaries blur** — L6 emits both new momentum signals *and* legacy per-stock signals | `layer-6-signal` | Pick one output contract for `trade-signals`; move legacy to a clearly separate topic or retire (P1/P2) |
| F7 | **Docker images not production-grade** | all `Dockerfile`s | §6 |

**Overall verdict:** the *shape* of the architecture is correct — event-driven, adapter-based, CQRS. It doesn't
need re-architecting. It needs **hardening (Docker, TLS, secrets)** and **two clarity fixes** (single data
gateway + credentials vault). That's a much cheaper, safer path than a rewrite.

---

## 4. Broker Credential Vault — add credentials from the UI

**Goal:** enter broker **API key / login (client) id / password / TOTP secret** from the dashboard, stored
encrypted, used by L1 (ticks) and L10 (orders) without anyone editing `.env`.

### 4.1 Flow
```
┌── L8 Dashboard ──┐     ┌──────── L7 Core API ────────┐     ┌── L3 Storage ──┐
│ Broker Settings  │     │ POST /brokers/credentials    │     │ broker_        │
│ • provider       │────►│   → AES-256-GCM encrypt       │────►│ credentials    │
│ • api key        │ TLS │   → store ciphertext          │     │ (ciphertext)   │
│ • client/login id│     │ POST /brokers/{id}/test       │     └────────────────┘
│ • password       │     │   → run login+TOTP, report ok │
│ • TOTP secret    │     │ GET  /brokers (masked status) │     ┌── Redis ───────┐
│ [Test] [Save]    │◄────│   (never returns secrets)     │────►│ broker:session:│
└──────────────────┘     └───────────────┬──────────────┘     │ {provider}     │
                                          │ session token      │ (token + TTL)  │
                    ┌─────────────────────┴───────────────┐    └────────┬───────┘
                    ▼                                      ▼             │ read token
             L1 Ingestion (ticks)                   L10 Execution (orders)◄┘
             reads creds+token from vault           reads creds+token from vault
```

### 4.2 Rules (security-critical)
- **Encrypt at rest:** AES-256-GCM. Master key from env (`CREDENTIAL_MASTER_KEY`) in dev; **AWS KMS / Secrets
  Manager** in prod. Never store plaintext.
- **Write-only secrets:** the API never returns a stored password/TOTP secret to the UI. UI shows masked status
  (`•••• configured`, last-tested time) only.
- **TOTP stays server-side:** the server generates 6-digit codes from the stored secret (as `mstock.js` already
  does with `otpauth`). The secret never leaves the server after entry.
- **Never log secrets or codes** (fixes F4).
- **Test-before-save:** the `Test` button runs the real login+TOTP handshake and reports success/failure so a
  bad credential never silently sits until market open.

### 4.3 Shared session cache (fixes F2)
A small **broker-auth responsibility** (a module in L7, or a tiny dedicated service) performs the login+TOTP
handshake **once**, caches the access token in Redis (`broker:session:{provider}`) with TTL, and refreshes it on
a timer *before* expiry. L1 and L10 both **read the token from Redis** instead of each logging in. One session,
one rate-limit footprint, one place to reason about expiry.

### 4.4 Adapter change (minimal, backward-compatible)
The vendors keep their current interface. Only the **credential source** changes:
```
// before: creds pulled from process.env inside the vendor
this.apiKey = process.env.MSTOCK_API_KEY

// after: injected credential provider (vault → Redis token → env fallback)
constructor({ credentials }) { this.creds = credentials }   // { apiKey, clientCode, password, totpSecret, token }
```
`factory.js` gets the creds from the vault (falling back to env for bootstrap) and injects them. **No vendor
logic rewritten** — the 2-step TOTP flow in `mstock.js` stays exactly as-is; it just reads `this.creds.*`.

### 4.5 New DB + topics
- `broker_credentials` table (L3): `id, provider, enc_payload, iv, tag, status, last_tested_at, created_at`.
- `broker_sessions` table (L3): `provider, token_ref, status, expires_at, last_login_at, last_error` (audit/history).
- No new Kafka topic needed; the **live** session token lives in Redis (fast read path, CQRS-compliant).

### 4.6 Centralized Broker Session Service — the MStock flow at API + DB level

**This is the core of what you're asking for.** Today the MStock login+TOTP flow lives *inside* the ingestion
vendor (`mstock.js` authenticates itself from `process.env`). That means the flow is duplicated and
uncentralized — if L10 also needs MStock, it logs in again. The fix is to lift the **entire broker session
lifecycle** up to **one owner at the API + DB level**, and turn every other layer into a passive token consumer.

**One owner:** a **Broker Session Service** inside L7 (Core API) — the *only* place that ever runs a broker login.

```
        ┌─────────────── L8 Dashboard ───────────────┐
        │ "MStock: ● Connected (expires 15:32)"       │
        │ [Connect] [Re-login] [Disconnect]           │
        └───────────────────┬─────────────────────────┘
                            │  REST (TLS)
        ┌───────────────────▼──────────────────────────────────────────┐
        │            L7 · BROKER SESSION SERVICE (single owner)          │
        │                                                               │
        │  1. read encrypted creds  ◄────────────────  L3 broker_       │
        │  2. login → verifyTOTP → trading token       credentials      │
        │     (the exact flow now in mstock.js,                          │
        │      moved here, generated server-side)                       │
        │  3. write token → Redis  broker:session:mstock  (TTL)         │
        │  4. write audit  → L3    broker_sessions                       │
        │  5. refresh on timer BEFORE expiry; re-login on failure       │
        │  6. expose: GET /brokers/mstock/session (status),             │
        │             POST /brokers/mstock/login | /logout              │
        └───────────────────┬───────────────────────────┬───────────────┘
                            │ token via Redis           │ token via Redis
                            ▼                            ▼
                   L1 Ingestion (ticks)          L10 Execution (orders)
                   NO login logic — just         NO login logic — just
                   reads the valid token         reads the valid token
```

**Session state machine (owned centrally, visible on the dashboard):**
```
DISCONNECTED ──login()──► LOGGING_IN ──ok──► TOTP_VERIFYING ──ok──► CONNECTED
     ▲                        │ fail             │ fail                 │
     │                        ▼                  ▼             expiry timer / 401
     └──────────────── ERROR (shown in UI) ◄─────┘                     │
                                                                        ▼
                                                     CONNECTED ◄──refresh── REFRESHING
```

**What changes in each layer (this is the simplification):**
- **L7 (API):** gains the Broker Session Service — the single brain for broker auth. Runs login+TOTP, owns the
  token, refreshes it, and reports status to the dashboard.
- **L1 vendors (`mstock.js` etc.):** **delete the `authenticate()` login/TOTP logic** from the vendor. The vendor
  just calls `getToken('mstock')` (reads Redis). If no valid token → it stays idle and reports "waiting for
  session," it never logs in itself. (Env fallback only for local dev.)
- **L10 execution:** same — reads the token from Redis; never authenticates.
- **L3 (DB):** stores encrypted creds (`broker_credentials`) + session audit (`broker_sessions`).
- **L8 (UI):** a broker panel showing live status and Connect/Re-login/Disconnect buttons.

#### MStock Type B login — the exact flow (verified against the official docs)

This has been implemented incorrectly **twice**, so it is written down and guarded by tests
(`layer-7-core-interface/api/tests/verify-mstock-session.js`, `npm run verify`).

```
1. POST https://api.mstock.trade/openapi/typeb/connect/login
     headers: X-Mirae-Version: 1 · Content-Type: application/json
     body:    { clientcode, password, totp: "", state: "" }
     ──► data.jwtToken  =  a short-lived REQUEST token (a UUID, e.g. 697c39bf-9411-…)
                           **NOT** the trading token.

2. POST https://api.mstock.trade/openapi/typeb/session/verifytotp
     headers: X-Mirae-Version: 1 · X-PrivateKey: <api_key> · Content-Type: application/json
     body:    { refreshToken: <the request token from step 1>, totp: <6-digit code> }
     ──► data.jwtToken  =  the real TRADING token  (Authorization: Bearer <this>)
```

| Trap | Reality |
|------|---------|
| "TOTP enabled ⇒ login returns the trading token" | **False.** Enabling TOTP only stops the OTP SMS/email. Step 2 is still required. |
| `if (resp.status === true)` | Login returns `"status": "true"` — a **string**. Accept both. |
| Fixed token TTL (e.g. 21000s) | Docs: *"Generated JWT token will be valid till 12:00 AM of generated day."* TTL = seconds to the next **IST midnight**. |
| Auth header alone is enough | Every authenticated call also needs **`X-PrivateKey: <api_key>`**, else *"API is suspended/expired for use"*. |
| Docs' endpoint table | Lists `/openapi/typeb/openapi/typeb/session/verifytotp` (path duplicated) and describes `Authorization: token api_key:access_token` for Fund Summary. **The cURL samples are authoritative:** `/openapi/typeb/session/verifytotp` and `Authorization: Bearer <jwtToken>`. |

Without a stored `totp_secret` the session **cannot** be established unattended (the OTP is delivered
out-of-band). The service returns `stage: 'needs_otp'` and caches nothing — it must never report success.

**Why this is better (maps to the principles):**
- **Centralized (your ask):** the MStock flow exists in exactly one place — L7 + DB + Redis — not smeared across
  L1/L10. One login, one token, one refresh loop, one audit trail.
- **Simpler layers (P1):** L1's job shrinks back to "stream ticks"; it's no longer also an auth client.
- **Robust (P5):** one session → no duplicate logins tripping broker rate limits; token refresh is proactive;
  the dashboard shows exactly why a connection is down.
- **Reuses existing code:** the working 2-step TOTP handshake in `mstock.js` is *moved*, not rewritten.

> **Not MStock-specific.** The Broker Session Service manages the auth lifecycle for **every** provider that needs
> it (MStock TOTP, FlatTrade token, Kite request-token, …) behind one interface. MStock is just the first. The
> registry below (§4.7) is how you turn any provider on or off.

### 4.7 Provider Registry — ANY provider, enable/disable/modify from the dashboard

The whole point: **no provider is hardcoded and none is selected by an env var.** Every provider is a **record in
the DB** that you manage from the dashboard — add credentials, edit them, flip it **on/off**, and set its role
and priority. The system reacts at runtime without a redeploy.

**This replaces `MARKET_DATA_PROVIDER` / `EXECUTION_BROKER` env vars** (`factory.js` currently reads
`process.env.MARKET_DATA_PROVIDER`) with a DB-driven, dashboard-controlled registry.

#### DB — `broker_providers` (the single source of truth for "who's active")
| Column | Meaning |
|--------|---------|
| `id` | row id |
| `provider` | `mstock` \| `flattrade` \| `kite` \| `indianapi` \| … |
| `enabled` | **on/off toggle from the dashboard** |
| `role` | `data` \| `execution` \| `both` — what this provider is allowed to do |
| `priority` | integer — lower = preferred; drives failover order in the `CompositeVendor` |
| `credentials_id` | FK → `broker_credentials` (encrypted secrets, §4) |
| `status` | `CONNECTED` \| `DISCONNECTED` \| `ERROR` \| `DISABLED` (live, from session service) |
| `last_tested_at` | last successful `Test` |

#### Dashboard — Provider Management panel
```
Provider    Role        Enabled   Priority   Status            Actions
────────────────────────────────────────────────────────────────────────────
FlatTrade   both        [ ON  ]      1        ● Connected       [Edit] [Test] [Logout]
MStock      data        [ ON  ]      2        ● Connected       [Edit] [Test] [Logout]
Zerodha     data        [ OFF ]      3        ○ Disabled        [Edit] [Test] [Enable]
IndianAPI   data        [ OFF ]      4        ○ Disabled        [Edit] [Test] [Enable]
                                                        [ + Add Provider ]
```
From here you can: **add** a provider, **edit** its credentials, **enable/disable** it, set its **role** and
**priority**, and **test/connect** it — every action is an API call, nothing touches `.env` or code.

#### API (L7) — CRUD + lifecycle
```
GET    /providers                 → list all with live status (secrets masked)
POST   /providers                 → add (provider, role, priority, credentials)
PATCH  /providers/{id}            → modify role / priority / credentials
POST   /providers/{id}/enable     → enabled = true  → session service connects it
POST   /providers/{id}/disable    → enabled = false → session service drops it, consumers stop using it
POST   /providers/{id}/test       → run login handshake, report ok/fail
```

#### Runtime effect — how enable/disable actually takes hold (no redeploy)
```
Dashboard toggle ─► L7 API updates broker_providers.enabled ─► publish "providers-changed" (Redis pub/sub)
                                                                        │
        ┌───────────────────────────────────────────────────────────────┤
        ▼                                                                 ▼
 L1 VendorManager rebuilds its CompositeVendor from the                L10 picks the enabled
 ENABLED data-providers, ordered by priority (failover)                execution-provider (role=execution|both)
```
- **L1** stops reading `MARKET_DATA_PROVIDER`. `VendorManager` queries the registry for `enabled && role∈{data,both}`
  providers, ordered by `priority`, and builds the `CompositeVendor` (your failover feed) from them. Disable Zerodha
  in the UI → it drops out of the composite on the next `providers-changed` event.
- **L10** stops reading `EXECUTION_BROKER`. It uses the enabled `role∈{execution,both}` provider with best priority
  (FlatTrade-first by your decision), and can fail over to the next if the primary is down.
- **Session service (§4.6)** maintains a live session for **each enabled** provider; disabling one tears its
  session down and clears its Redis token.

**Result:** one dashboard screen controls every broker — add, edit, enable, disable, prioritize — with all state
centralized in DB + API. The layers just consume whatever the registry says is live.

---

## 5. Broker Adapters via the Adapter Pattern — the plan

The adapter **exists** (`MStockVendor extends BaseVendor`). The plan is to finish it *cleanly*, not rebuild.

| Step | Action | Why |
|------|--------|-----|
| 1 | Source MStock creds from the **vault** (§4.4), env as fallback | Enables UI credential entry (F1) |
| 2 | Read/write the access token via the **shared Redis session** (§4.3) | One session for ticks + orders (F2) |
| 3 | Remove the **global console monkey-patch**; set the SDK/logger to the right level instead | Robustness (F5) |
| 4 | Stop logging the TOTP code / token | Security (F4) |
| 5 | Use MStock as an **executor in L10** via the same adapter contract (order place/modify/cancel) | FlatTrade is primary; MStock is the tested secondary — one interface, two brokers |
| 6 | Confirm **rate limits + SEBI algo tagging** with MStock before live | Compliance gate (already noted in scalping doc) |

**Contract (both data + orders):** define one `BrokerAdapter` shape reused across L1 and L10 so MStock,
FlatTrade, and Kite are interchangeable:
```
BrokerAdapter {
  // data (L1)
  connect() / disconnect() / subscribe(symbols) / onTick / getHistoricalData() / getOptionChain()
  // orders (L10)
  placeOrder() / modifyOrder() / cancelOrder() / getOrderBook() / getPositions() / getQuote()
  // shared
  authenticate()   // uses vault creds → Redis session token
}
```
Not every broker implements every method (a data-only vendor throws on `placeOrder`), but the **shape is one**.
This is the "each layer knows only the interface, never the broker" simplification.

---

## 6. Docker & Infra Hardening — concrete issues + fixes

Analyzed the actual Dockerfiles. Findings, most severe first:

| # | Severity | Issue | Files | Fix |
|---|----------|-------|-------|-----|
| D1 | 🔴 Critical | **Runtime TLS verification OFF** (`NODE_TLS_REJECT_UNAUTHORIZED=0`) — accepts any cert when talking to brokers → MITM on creds/orders | `layer-1-ingestion/Dockerfile` | Remove the runtime ENV. If a corporate proxy needs it at **build** time only, scope `strict-ssl false` to a build stage; install proper CA certs for runtime. |
| D2 | 🟠 High | **Runs as root** (no `USER`) | `layer-1-flattrade-python`, `layer-9-ai-service` (and verify others) | Add a non-root `appuser` in every image. |
| D3 | 🟠 High | **No init / signal handling** — Node/uvicorn as PID 1 don't forward SIGTERM well; L10 must square-off cleanly on shutdown | all, esp. `layer-10-execution` | Use `tini` (or compose `init: true`) so SIGTERM → graceful shutdown. |
| D4 | 🟡 Med | **`npm install --only=production`** is non-reproducible; mutates lockfile | all Node images | `npm ci --omit=dev` with committed `package-lock.json`. |
| D5 | 🟡 Med | **No multi-stage builds** → build tools (`build-essential`, dev deps) ship in runtime; large images | all | Builder stage installs/compiles; runtime copies only artifacts. |
| D6 | 🟡 Med | **No `.dockerignore`** → `.git`, `node_modules`, **`.env`** can leak into image layers (secret exposure + bloat) | all | Add `.dockerignore` per service (`node_modules`, `.git`, `.env*`, `*.md`, `tests`, `coverage`). |
| D7 | 🟡 Med | **Missing healthchecks** on Python services | `layer-1-flattrade-python`, `layer-9-ai-service` | Add `HEALTHCHECK` hitting a `/health` endpoint. |
| D8 | 🟢 Low | **Unpinned base images** (`node:20-alpine`, `python:3.11-slim`) | all | Pin by digest; standardize Node 20 / Python 3.11 across services. |
| D9 | 🟢 Low | **No resource limits / log rotation / restart policy** | compose files | Add `deploy.resources.limits`, `restart: unless-stopped`, `logging` max-size in compose. |
| D10 | 🟢 Low | **Secrets via env baked context** | all | Inject secrets at runtime (docker secrets / vault), never `COPY` an `.env`. |

### Reference hardened Node Dockerfile (template for all Node layers)
```dockerfile
# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev          # reproducible; needs committed lockfile
COPY . .

# ---- runtime ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /app /app
USER app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
# NOTE: no NODE_TLS_REJECT_UNAUTHORIZED=0. TLS stays ON.
```
(+ a `.dockerignore` next to each: `node_modules`, `.git`, `.env*`, `*.md`, `tests`, `coverage`.)

---

## 7. Per-Layer Simplification — one job, one in, one out

The target state (P1/P2). If a layer's real behaviour differs, that's the cleanup list.

| Layer | One-sentence job | Input (one) | Output (one) |
|-------|------------------|-------------|--------------|
| L1 Ingestion | Be the **single broker data gateway** (live + historical + option chain) | Broker WS/REST | `raw-ticks` (+ `option-chain`) |
| L2 Processing | Turn ticks into candles | `raw-ticks` | `market_candles` |
| L3 Storage | Persist writes / serve fast reads (CQRS) | `market_candles` (+ others) | TimescaleDB + Redis |
| L4 Analysis | Compute indicators per symbol | `market_candles` | `analysis_updates` |
| L5 Aggregation | Compute breadth + sector + **regime** | `analysis_updates` | `sentiment_scores` / `market-regime` |
| L6 Signal | Run the strategy framework → signals | `market-regime` + `analysis_updates` | `trade-signals` |
| L7 Core API | Expose data + **broker credential vault** to clients | REST/WS + Kafka | HTTP/WS |
| L8 Presentation | Dashboard + Telegram (incl. **broker settings UI**, `/kill`) | HTTP/WS | user |
| L10 Execution | Be the **single order gateway** | `trade-signals` | Broker orders + `execution-events` |

**Simplification actions:** (a) enforce single data gateway (§2) — delete any direct-socket ambitions;
(b) one `trade-signals` contract (F6); (c) centralise broker session (§4.3) so auth isn't smeared across L1/L10;
(d) each consumer idempotent, each service one process with one clear responsibility.

---

## 8. Implementation Phases

```
Phase 1 — Docker & TLS hardening (safety first, no behaviour change)
  ├── Remove NODE_TLS_REJECT_UNAUTHORIZED=0 (D1); verify broker calls still work with TLS on
  ├── Add .dockerignore + multi-stage + npm ci + non-root + tini to every service (D2–D8)
  └── Add resource limits / restart / log rotation in compose (D9)

Phase 2 — Broker Credential Vault
  ├── L3: broker_credentials table (encrypted)
  ├── L7: POST/GET credentials, /test endpoint, AES-256-GCM, masked reads
  ├── Redis shared session cache + refresh timer (§4.3)
  └── L8: Broker Settings UI (add/test/rotate)

Phase 3 — Adapter credential wiring
  ├── factory.js injects creds from vault (env fallback)
  ├── MStock + FlatTrade + Kite read this.creds / Redis token (no logic rewrite)
  ├── Remove console monkey-patch + secret logging (F4, F5)
  └── Reuse the one BrokerAdapter contract in L10 (MStock as secondary executor)

Phase 4 — Layer boundary cleanup
  ├── Single data gateway enforced (no direct sockets outside L1)
  ├── One trade-signals contract (retire/relocate legacy per-stock signals)
  └── Idempotency + health endpoints audited per layer
```

---

## 9. Decision Record

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-09 | Two broker touchpoints only: L1 (data), L10 (orders) | Removes duplicated sockets/normalization/rate-limits — the main source of confusion |
| 2026-07-09 | Live ticks consumed via ingestion → Kafka, never a direct socket per layer | Single source of truth; one reconnect path; simpler + robust |
| 2026-07-09 | Ingestion is always-on (live + historical), not a market-off-only role | It is the data gateway at all times |
| 2026-07-09 | Hot-path/direct-socket scalping stays OUT of v1 | Owner accepts lag; keeps architecture simple |
| 2026-07-09 | Keep the existing adapter pattern; add a credential vault + shared session | Adapter is correct; the gap is secret sourcing, not structure |
| 2026-07-09 | Credentials entered via UI, encrypted at rest, TOTP server-side, write-only | Usability + security; no more `.env` editing |
| 2026-07-09 | Remove runtime TLS-disable; harden all Dockerfiles | A trading system must not accept unverified TLS to brokers |

---

## 10. Hand-off

- **Next agent (security/infra):** Phase 1 — remove `NODE_TLS_REJECT_UNAUTHORIZED=0`, verify broker TLS works,
  then roll the hardened Dockerfile template + `.dockerignore` across all services.
- **Next agent (backend):** Phase 2/3 — build the credential vault (L3 table, L7 endpoints, Redis session) and
  wire `factory.js` + vendors to read from it (env fallback). Remove secret logging + console monkey-patch.
- **Next agent (frontend):** Phase 2 — Broker Settings UI (add / test / rotate credentials; masked display).
- **Owner input needed:** confirm prod secret store (env master key vs AWS KMS/Secrets Manager) and whether
  credentials are single-account or multi-user.
- **Not done / not pushed:** design only; no code changed, no git operations. Left for review.
