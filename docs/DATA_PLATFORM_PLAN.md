# Data Platform Plan — Dual Broker, 3-Year Backfill, Coverage Map, Realtime

> **Owner goals:** (1) run MStock **and** FlatTrade together, FlatTrade mostly for execution; (2) pull history
> into TimescaleDB and **know exactly from which timestamp we have data** — that is the whole point of
> backfill/swarm; (3) async-pull **~3 years of 1-minute candles**, triggered from the Backfill/Swarm page;
> (4) the Swarm page must show **real** progress (how much data actually landed); (5) get realtime right for
> scalping, without latency regressions. Mostly an after-hours activity.
>
> **Status:** design. Verified against the live code + running containers on 2026-07-13.
> **Read with:** `BACKFILL_SYSTEM_PLAN.md` (root causes already fixed), `WIRING_GAPS_AND_FIXES.md` (gap register).

---

## 0. The numbers (compute them before designing anything)

| Quantity | Value |
|---|---|
| Universe | 50 constituents + NIFTY + BANKNIFTY = **52 symbols** |
| Trading days in 3 years | ~750 (250/yr) |
| 1-minute bars per day | ~375 (09:15–15:30 IST) |
| **MStock API cap** | **~1000 candles/request** → **2 trading days per request** for 1m (`historical-chunker.ts`) |
| **API requests for a 3-year, 52-symbol, 1m backfill** | **~19,500** |
| **Rows landing in `candles_1m`** | **~14.6 million** |
| Wall-clock, serial @3 req/s | ~108 min |
| Wall-clock, swarm concurrency 12 (rate-limit permitting) | ~10–20 min |

14.6M rows is nothing for TimescaleDB (compression is already configured). **The API call count is the real
cost**, and it is why this must be a resumable, rate-limited, work-unit job — not a script you re-run from zero.

---

## ⚠️ 1. THE CRITICAL UNKNOWN — do not assume 3 years of 1m data exists

Most Indian brokers **cap intraday history** (Zerodha, for example, serves only ~60 days of 1-minute data).
**We have not verified how far back MStock or FlatTrade actually serve 1-minute candles.** If the cap is 60 days,
a "3-year 1m backfill" is impossible from that source and the plan must change — no amount of engineering fixes it.

**Therefore Phase 0 is a PROBE, not a build.** Empirically discover, per provider × interval, the oldest
timestamp that actually returns data, and record it. Design around the answer, don't guess it.

```
for provider in [mstock, flattrade]:
  for interval in [ONE_MINUTE, FIVE_MINUTE, ONE_DAY]:
    binary-search backwards (today−30d, −90d, −180d, −1y, −2y, −3y, −5y)
    → first date that returns 0 candles = the wall
    → write to provider_capabilities(provider, interval, max_lookback_days, verified_at)
```

**Likely outcome and the fallback:** 1m may only reach back weeks/months; daily and 5m usually go back years.
If so, the tiered plan is:
- **1m** → as far back as the broker allows (probe result), rolling forward daily from now on. Since we now
  ingest and store live ticks → candles, our own 1m history **accumulates from today onward** and becomes the
  long-term asset no broker can give us.
- **5m / 15m / 1D** → backfill the full 3 years (far fewer candles, longer lookback).
- Derive coarser intervals from 1m where we have it (TimescaleDB continuous aggregates already exist).

This is the single most important thing to learn before writing the swarm.

---

## 2. Broker roles — decided by CAPABILITY, not preference

### 2.0 CONFIRMED from the official docs (2026-07-13) — run BOTH, simultaneously

The owner's model — **FlatTrade for execution + scalping, MStock for data** — is correct, and the docs confirm
each broker covers the other's gaps. Both are enabled at once; `broker_providers.role` already models this.

| Capability | MStock | FlatTrade | Use |
|---|---|---|---|
| Live ticks | ✅ WS, **mode 3 (SNAP)**: LTP, OHLC, vol, **OI**, full depth | ✅ WS touchline: `lp,o,h,l,c,v,ap`, **`oi`,`poi`,`toi`**, `bp1/sp1` | **Dual feed + failover** |
| **Index ticks** | ❌ tokens still `TODO_VERIFY` | ✅ **NIFTY `NSE\|26000`, BANKNIFTY `NSE\|26009`** (documented) | **FlatTrade unblocks index data today** |
| Historical 1m | ✅ chunked, ~1000-candle cap | ✅ `get_time_price_series` (`intrv` 1/3/5/…/240 min, epoch `st`/`et`), returns OHLC + **`oi`/`intoi`** | **Two sources → cross-fill gaps** |
| Historical daily | ✅ | ✅ `get_daily_price_series` (multi-year in their own sample) | 3-year daily is realistic |
| **Order/position updates** | ❌ | ✅ **WS push** (`order_update_callback`, `subscribe_orders`) — fills/rejects/`rejreason` pushed, not polled | **FlatTrade — no polling** |
| Option chain / greeks | ⚠️ chain only | ✅ `get_option_chain` + **`Get Option Greek`** | **FlatTrade** (MStock ticks carry OI but **no IV/greeks**) |
| Resting SL-M + order status | ❌ | ✅ | **FlatTrade is the ONLY valid executor** |

**Token insight:** FlatTrade's `searchscrip` sample returns `RELIANCE-EQ → 2885` — the **same** token MStock uses.
Both consume raw **NSE exchange tokens** (unlike Kite, which uses its own scheme). So one NSE token map likely
serves both brokers. *Verify per-symbol before relying on it* — a wrong token silently returns zero data (GAP-I2).

**What MStock ticks CANNOT give you:** **IV and greeks**. Ticks carry OI and depth, but implied volatility and
delta/theta/gamma must come from FlatTrade's `Get Option Greek` or be computed via Black-Scholes (we already have
a BS model in `scripts/backtest/option-simulator.js`).



The strategies already declare capabilities (verified in code):

| Provider | data | execution | restingStop | orderStatus |
|---|---|---|---|---|
| **mstock** | ✅ | ✅ | ❌ | ❌ |
| **flattrade** | ✅ | ✅ | ✅ | ✅ |

Contract **rule 11** says a `LiveExecutor` must **refuse to construct** on an OMS without `supportsRestingStop`
/ `getOrderStatus`. So this is not a preference:

- **FlatTrade = EXECUTION.** It is the *only* provider that can place a broker-side resting SL-M — the thing
  that keeps a position protected if our process dies. MStock **cannot** be the executor.
- **MStock = DATA (primary).** It has the chunked historical API and the TypeB tick socket, both already wired.
- **FlatTrade = DATA (secondary).** Option-chain poller already uses it; also the failover tick feed and a
  second historical source for gap-filling.

This is already modelled: `broker_providers.role` ∈ {`data`, `execution`, `both`} + `priority`.

**Action:** set `mstock.role = data`, `flattrade.role = execution` (it may serve data as a fallback via
`priority`). Add a **startup assertion**: if the configured executor lacks `restingStop`, refuse to start (rule 11).

---

## 3. What already exists (do not rebuild)

| Piece | Where | State |
|---|---|---|
| Chunker (1000-candle cap → 2 days/req for 1m) | `src/utils/historical-chunker.ts` | ✅ |
| Swarm pool (p-limit, `SWARM_CONCURRENCY`, retry+backoff) | `src/vendors/base.js` | ✅ |
| Provider-agnostic runner | `scripts/backfill-runner.ts` | ✅ (SyntaxError fixed today) |
| Job table | `backfill_jobs` | ✅ |
| **Coverage map table** | `data_availability(symbol, timeframe, first_date, last_date, total_records, gaps, quality_score)` | ✅ **exactly what the owner asked for** |
| Candle store | `candles_1m` hypertable + continuous aggregates | ✅ |
| Trigger + job APIs | `POST /system/backfill/trigger`, `GET /backfill/:id`, `/data/availability`, `/data/gaps` | ✅ |
| Swarm status channel | Redis `system:layer1:swarm_status` + `swarm:updates` | ✅ |
| Dashboard panels | `BackfillPanel`, `SwarmMonitor` | ✅ |
| Session auto-refresh (300s MStock tokens) | L7 `startSessionMonitor()` | ✅ |
| Config in DB | migration `008_control_plane_config.sql` (`instrument_tokens`, `app_config`, …) | ✅ |

**The pipeline is ~85% built.** What is missing is the *job model* that makes it resumable, observable and
honest — plus the probe.

---

## 4. Missing pieces (the actual work)

| # | Gap | Consequence |
|---|---|---|
| D1 | **No work-unit model.** A job is one boolean (`isBackfilling`) + one script run | A 19,500-request job that dies at request 18,000 restarts from zero. No resume, no queue, no per-symbol progress |
| D2 | **Coverage map never populated** | We cannot answer "from which timestamp do we have data" — the owner's stated core purpose |
| D3 | **Progress is one global %** | Swarm page cannot show "RELIANCE 340/375 chunks, 127k rows" |
| D4 | **No rate limiter** | 19,500 requests will trip broker limits and get us throttled/banned |
| D5 | **No idempotency assertion** on candle insert | Re-running a range risks duplicate bars (rule 5 wants `ON CONFLICT DO NOTHING`) |
| D6 | **No lookback knowledge** | We will silently request 3 years and get 60 days, then report "success" |
| D7 | **No after-hours scheduling** | A 20-minute swarm during market hours competes with the live tick feed |
| D8 | Instrument tokens still file-based | Wrong-broker tokens silently return zero rows (the GAP-I2 class of bug) |

---

## 5. Target architecture

### 5.1 Control flow (dashboard = command centre, L7 = orchestrator)

```
Backfill/Swarm page
  │  POST /api/v1/system/backfill/trigger { from, to, universe, interval, provider? }
  ▼
L7  ── creates backfill_jobs row (QUEUED)
    ── EXPANDS the range into work units  ← the key change
    ── publishes REDIS_CHANNELS.SYSTEM_COMMANDS
  ▼
L1 swarm worker  (pool = SWARM_CONCURRENCY, from app_config)
    ── claims PENDING units (SKIP LOCKED)
    ── rate-limited fetch  → upsert candles_1m (ON CONFLICT DO NOTHING)
    ── updates unit status + rows_written
    ── recomputes data_availability for that symbol
    ── publishes progress → REDIS_CHANNELS.BACKFILL_PROGRESS
  ▼
L7 relays progress → WS room `backfill` → Swarm page (live, real numbers)
```

### 5.2 The work-unit model (this is the whole design)

```sql
-- migration 009
CREATE TABLE backfill_units (
  id           BIGSERIAL PRIMARY KEY,
  job_id       UUID NOT NULL REFERENCES backfill_jobs(job_id),
  symbol       TEXT NOT NULL,
  provider     TEXT NOT NULL,          -- mstock | flattrade
  interval     TEXT NOT NULL,          -- ONE_MINUTE ...
  from_ts      TIMESTAMPTZ NOT NULL,   -- chunk start (09:15 IST)
  to_ts        TIMESTAMPTZ NOT NULL,   -- chunk end   (15:30 IST)
  status       TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|RUNNING|DONE|FAILED|EMPTY
  attempts     INT  NOT NULL DEFAULT 0,
  rows_written INT  NOT NULL DEFAULT 0,
  error        TEXT,
  claimed_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (job_id, symbol, interval, from_ts)      -- one unit per chunk: re-expansion is idempotent
);
CREATE INDEX ON backfill_units (job_id, status);
CREATE INDEX ON backfill_units (status, provider);
```

One unit = **one API call** = one chunk (2 days of 1m). A 3-year 52-symbol job = **19,500 units**.

Why this earns its keep:
- **Resumable** — a crash loses at most the in-flight units; re-triggering re-claims only `PENDING`/`FAILED`.
- **Real progress** — `COUNT(DONE)/COUNT(*)`, per symbol, per job. Exactly what the Swarm page needs.
- **`EMPTY` is a first-class status** — a chunk that legitimately has no data (holiday, pre-listing, beyond the
  broker's lookback wall) is **not** a failure and must never be retried forever.
- **Safe concurrency** — workers claim with `FOR UPDATE SKIP LOCKED`; scale by adding workers, not by hoping.

### 5.3 Coverage map (the owner's "from which timestamp do we have data")

After each unit, recompute for that `(symbol, timeframe)`:

| Column | Meaning |
|---|---|
| `first_date` / `last_date` | **the answer to "from when do we have data"** |
| `total_records` | actual bar count in `candles_1m` |
| `gaps` (JSON) | trading days inside `[first,last]` with < expected bars |
| `quality_score` | `bars_present / bars_expected` |

Derive it from the **candles themselves**, never from "the job said it succeeded" (rule 12). The Backfill page
renders a **symbol × month heat-map**; `GET /api/v1/data/gaps` drives a one-click "fill the holes" job.

### 5.4 Rate limiting

Token bucket **per provider**, configured in `app_config` (`mstock.rate_limit_rps`, etc.) so it is tunable
without redeploy. Respect `429`/throttle responses with exponential backoff. The swarm's concurrency is capped
by the bucket, not the other way round.

### 5.5 Scheduling (after-hours)

`app_config: backfill.window = { start: "16:00", end: "08:30", tz: "IST" }`. A large job **auto-pauses** at
market open and resumes after close — the live tick feed must never contend with a 19,500-request swarm.
Small/manual jobs may override with an explicit flag.

### 5.6 Realtime for scalping (a separate plane — keep it that way)

Latency is a property of the **live** path, and the single biggest risk to it is letting backfill share its
resources. Keep them apart:

```
MStock WS (primary)  ─┐
                      ├─► L1 feed handler ─► Redis PUBLISH (ticks)  ─► L7 relay ─► dashboard
FlatTrade WS (backup)─┘                   └─► Kafka raw-ticks       ─► L2 candles ─► storage
                                          └─► in-memory ring buffer ─► scalp strategy (HOT PATH)
```

- **Dual feed with failover** (already decided in `MOMENTUM_TRADING_ARCHITECTURE.md` §11.1): health-score both
  feeds on last-tick age; cut over on staleness > ~1.5s; guard against divergence.
  ⚠️ `BROKER_BASE_URLS.FLATTRADE_WS` is marked **UNVERIFIED** — verify before relying on it as the backup.
- **Hot path bypasses Kafka.** For T1 scalps the decision reads an in-memory buffer; Kafka remains the journal
  and the feed for everything non-latency-critical. Do not put a broker/queue hop in the entry decision.
- **Backfill runs in a separate process** (already forked) and is **rate-limited + after-hours**, so it cannot
  starve the feed.
- **Freshness is a safety property** — every tick carries a timestamp; a stale feed must show `STALE` on screen,
  never a frozen last price (rule 13).

---

## 6. Implementation phases (each independently verifiable)

| # | Phase | Acceptance |
|---|---|---|
| **0** | **PROBE the lookback wall** per provider × interval; store in `provider_capabilities` | We can state, with evidence, how far back 1m data actually exists. **Everything else depends on this** |
| 1 | Provider roles: `mstock=data`, `flattrade=execution`; startup assertion that the executor supports resting stops | L10 refuses to start with a non-resting-stop OMS |
| 2 | Migration **009**: `backfill_units` + `provider_capabilities`; move instrument tokens into `instrument_tokens` (008) | Tables exist; token lookup is DB-backed and **fails closed** on a missing token |
| 3 | L7 job expander: range × universe × chunker → units (idempotent `UNIQUE`) | A 3-year job creates ~19,500 `PENDING` units |
| 4 | L1 swarm worker: claim (`SKIP LOCKED`) → rate-limited fetch → `ON CONFLICT DO NOTHING` upsert → unit status | Re-running a completed range inserts **0** new rows |
| 5 | Coverage map: recompute `data_availability` from candles after each unit | `/api/v1/data/availability` returns real first/last/gaps per symbol |
| 6 | Progress: publish per-unit → WS room `backfill`; Swarm page shows per-symbol counts + rows | Page shows "RELIANCE 340/375 chunks · 127,412 rows" live |
| 7 | Scheduling: after-hours window, auto-pause at market open | A running job pauses at 09:15 IST and resumes at 16:00 |
| 8 | Gap-fill action: `/data/gaps` → one-click job for only the holes | Holes visible on the heat-map; one click fills them |
| 9 | Realtime hardening: dual-feed failover + staleness badges; verify `FLATTRADE_WS` | Killing the primary feed cuts over within one tick cycle; UI shows STALE if both die |

**Ship order:** 0 → 2 → 3 → 4 → 5 → 6 (that is "3 years of data, visible, resumable"), then 7–9.

---

## 7. Non-negotiables for whoever implements this

1. **Probe before you build (Phase 0).** A 3-year 1m backfill against a 60-day API is 19,500 requests that
   return nothing, and a job that proudly reports "COMPLETE".
2. **Never fabricate success.** 0 candles + a broker error is a **FAILED** unit, not a completed one. This
   already bit us: the runner logged `✅ Done: 0 candles` after a 401.
3. **Idempotent writes** (`ON CONFLICT DO NOTHING`) — a re-run must add zero rows.
4. **Fail closed on a missing instrument token.** Never substitute another broker's token: the feed connects,
   the subscribe is accepted, and zero data arrives (this exact bug cost us MStock's entire feed).
5. **Coverage from the candles, not from the job status** (rule 12).
6. **Backfill must never degrade the live feed** — separate process, rate-limited, after-hours.
7. **All config from the DB** (`app_config`), not env: concurrency, rate limits, window, universe.

## 8. Hand-off

- **Blocked on the owner:** MStock `totp_secret` currently holds a **6-digit code**, not the Base32 **secret** —
  so unattended re-auth fails and MStock returns 401 on every call. Nothing above can be tested against live
  data until that is corrected.
- **Open verification:** `BROKER_BASE_URLS.FLATTRADE_WS` (unverified); FlatTrade historical (`TPSeries`) limits;
  NIFTY/BANKNIFTY index tokens (**GAP-H1**).
- Gaps registered as **D1–D8** in `WIRING_GAPS_AND_FIXES.md` §0.
