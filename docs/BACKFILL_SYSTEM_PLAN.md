# Backfill & Swarm System — Root Cause + Redesign Plan

> **Goal (owner):** trigger a backfill from the dashboard and watch it run; keep a **coverage map** of how much
> history exists per symbol; and when a date range **X → Y** is chosen, pull **NIFTY + BANKNIFTY + all 50
> constituents** for that range, as **1-minute candles**, into TimescaleDB.
>
> **Status:** the dashboard trigger is **broken at the first step** — root cause found by *running* it, not by
> reading docs (rule 12). Everything downstream of that has never been exercised.
> **Verified:** 2026-07-13 against the live `ingestion` container.

---

## 1. THE ROOT CAUSE (verified by execution)

`layer-1-ingestion/scripts/backfill-runner.js` is **TypeScript source saved with a `.js` extension**.
Node parses `.js` as plain JavaScript and dies immediately:

```
$ docker exec ingestion node -e 'require("/app/scripts/backfill-runner.js")'
/app/scripts/backfill-runner.js:33
async function loadProvider(providerName?: string) {
                                        ^
SyntaxError: Unexpected token '?'
```

Its own header says *"backfill-runner.**ts** — Provider-agnostic historical data backfill"*. It was authored as
TypeScript and shipped as `.js`.

**The whole chain therefore dies at step 1:**

```
Dashboard "Start Backfill"
  → POST /api/v1/system/backfill/trigger            (L7)          ✅ reached
  → POST http://ingestion:9101/api/backfill/historical (L7 → L1)  ✅ reached
  → runBackfill()                                    (L1)         ✅ reached
  → fork('scripts/backfill-runner.js')               (L1)         💥 SyntaxError
  → .catch(err => logger.error(...))                              🤫 swallowed
```

**And the dashboard is told it worked.** `POST /api/backfill/historical` returns
`{ success: true, message: 'Started backfill' }` *immediately*, before the child process has even parsed.
The job row is created as `RUNNING` and then never advances. That is a **fabricated success** (rule 13) — the
UI shows a green "started" for a job that crashed a second later.

### Same class of defect, same directory

| Script | `node --check` | Note |
|---|---|---|
| `backfill-runner.js` | ❌ **SyntaxError** | TS content, `.js` name — **kills every backfill** |
| `batch_streaming.js` | ❌ **fails** | same class; audit before use |
| `feed_kafka.js` | ✅ ok | step 2 of the pipeline |
| `generate_token.js` | ✅ ok | |

`batch_nifty50.js` was deleted, `batch_nifty50.ts` kept — the same migration that left `backfill-runner`
half-converted. **`ts-node` is installed in L1**, which contract **rule 15 forbids** ("ts-node breaks on
TypeScript 7 — use `tsx`"); and `runScriptWithIPC` spawns with a bare `fork(scriptPath)`, which cannot execute
TypeScript at all regardless.

> **Why the existing gate missed it:** `shared/tests/no-ts-js-twins.test.js` looks for a file existing as *both*
> `x.ts` **and** `x.js`. Here there is only `backfill-runner.js` — TS content wearing a `.js` name. The gate has a
> blind spot; §6 closes it.

---

## 2. What we already have (do NOT rebuild)

| Piece | Where | State |
|---|---|---|
| Dashboard panel (from/to/symbol, 30-day cap, coverage table) | `features/Backfill/components/BackfillPanel.tsx` | ✅ built |
| Swarm monitor UI | `features/BackfillManager/SwarmMonitor.tsx`, `/swarm` | ✅ built |
| Trigger endpoint | `POST /api/v1/system/backfill/trigger` (L7) | ✅ built |
| Job CRUD | `GET /api/v1/backfill`, `/backfill/:jobId`, `PATCH /backfill/:jobId` | ✅ built |
| **Coverage map API** | `GET /api/v1/data/availability` · `/data/stats` · `/data/gaps` | ✅ built |
| **Coverage map TABLE** | `data_availability(symbol, timeframe, first_date, last_date, total_records, gaps JSON, quality_score)` | ✅ **exactly the map the owner wants** |
| Job table | `backfill_jobs` | ✅ built |
| Candle store | `candles_1m` hypertable | ✅ built |
| Swarm progress channel | Redis `system:layer1:swarm_status` (KV) + `swarm:updates` (pub/sub), written by `vendors/base.js` | ✅ built |
| Kafka feed step | `scripts/feed_kafka.js` | ✅ built |
| Command channel | Redis `system:commands` → L1 `START_BACKFILL` (Telegram uses this path) | ✅ built |

**The system is ~85% built and 0% working, because step 1 throws a SyntaxError.**

---

## 3. Architecture defects (beyond the crash)

| # | Defect | Why it matters |
|---|---|---|
| **L1** | **TS-in-`.js` scripts** + `fork()` (plain node) + `ts-node` present | The crash. Violates rule 15 |
| **L2** | **Fabricated success**: L1 returns `{success:true}` *before* the child runs; errors are `.catch`-logged and dropped | Dashboard shows green while nothing happens (rules 11/13) |
| **L3** | **Two competing trigger paths**: L7→L1 **direct HTTP** (`ingestion:9101`) *and* Redis `system:commands` (Telegram) | Direct HTTP between layers violates rule 4; two paths = two behaviours |
| **L4** | `isBackfilling` is a single in-process boolean | No queue, no concurrency, no resume; a second trigger is silently dropped |
| **L5** | **Single-symbol or "all"**; no range fan-out to NIFTY + BANKNIFTY + 50 constituents | The owner's core requirement is not implemented |
| **L6** | Instrument map is **file-based** with a silent fallback to the *wrong broker's* tokens (**GAP-I2**) | Backfill would pull Kite tokens on MStock ⇒ empty data |
| **L7** | **Index tokens (NIFTY/BANKNIFTY/VIX) unverified** (**GAP-H1**) | Index history — the primary requirement — may fetch nothing |
| **L8** | `data_availability` is only written *after* a successful run | The coverage map has always been empty, because no run ever succeeded |
| **L9** | No idempotency assertion on candle insert (rule 5 wants `ON CONFLICT DO NOTHING`) | Re-running a range could duplicate 1-min bars |
| **L10** | Progress is one global percentage | No per-symbol progress; can't see "32 of 52 symbols done" |

---

## 4. Target design

### 4.1 Trigger (one path, event-driven)

```
Dashboard ──POST /api/v1/system/backfill/trigger──▶ L7
                                                     │ creates backfill_jobs row (QUEUED)
                                                     │ publishes REDIS_CHANNELS.SYSTEM_COMMANDS
                                                     ▼
                                              L1 job worker  ◀── (Telegram publishes the same channel)
                                                     │ expands range → symbol×day work units
                                                     │ fetches 1m candles per unit (bounded concurrency = swarm)
                                                     │ upserts candles_1m  (ON CONFLICT DO NOTHING)
                                                     │ updates data_availability per symbol
                                                     │ progress → REDIS_CHANNELS.BACKFILL_PROGRESS
                                                     ▼
                                            L7 relays progress → WS room `backfill`
                                                     ▼
                                            Dashboard live progress + coverage map
```

**Delete the L7→L1 direct HTTP call** (rule 4). One trigger path: publish a command; L1 consumes it. The
Telegram path already proves this works.

### 4.2 Range fan-out (the owner's requirement)

A job is `{ from, to, universe }`, where `universe` defaults to **`NIFTY50_FULL`**:

```
universe NIFTY50_FULL = [NIFTY, BANKNIFTY] + all 50 constituents (point-in-time as of `to`)
work units          = universe × trading-days(from..to)      // NSE calendar, skip weekends/holidays
```

Each unit = *(symbol, day)* → fetch 1-minute candles → upsert. Units are the swarm's queue: bounded
concurrency (`SWARM_CONCURRENCY`), retry with backoff, and **per-unit status** so a partial failure resumes
instead of restarting.

**Constituents must come from `instruments` (DB), not `vendor/nifty50_shared.json`** — and must be
**point-in-time** (`index_membership`, which already exists in migration 007). Backfilling 2024 with today's
50 names is the survivorship bug the predictive plan already warns about.

### 4.3 Coverage map (already has a table — just populate it)

After each unit, upsert `data_availability`:

| Column | Meaning |
|---|---|
| `symbol`, `timeframe` (`1m`) | key |
| `first_date`, `last_date` | **"how many months/days of data do I have"** |
| `total_records` | bar count |
| `gaps` (JSON) | missing trading days inside `[first,last]` |
| `quality_score` | `bars_present / bars_expected` for the range |

Dashboard renders it as a **coverage grid** (symbol × month heat-map), so a glance answers *"where are my holes?"*.
`GET /api/v1/data/gaps` then drives a one-click **"backfill the gaps"** action.

### 4.4 Idempotency & safety

- `INSERT ... ON CONFLICT (time, symbol) DO NOTHING` on `candles_1m` (rule 5) → re-running a range is free.
- A job is resumable: work units carry status; a crashed job restarts only unfinished units.
- Rate-limit/backoff per vendor; **fail loud** if the instrument map or index token is missing (never fall back
  to another broker's tokens — GAP-I2).

---

## 5. Plan (ordered, each step independently verifiable)

| # | Step | Where | Proves itself by |
|---|---|---|---|
| **1** | **Fix the crash.** Rename `backfill-runner.js` → `.ts`; spawn via `tsx` (`fork` with `execArgv: ['--import','tsx']`, or `spawn('node',['--import','tsx',script])`). Do the same for `batch_streaming.js`. **Remove `ts-node`** (rule 15). | L1 `scripts/`, `runScriptWithIPC` | `node --check` / `tsx` loads every script; a dashboard trigger writes rows to `candles_1m` |
| **2** | **Stop faking success.** L1 must not return `{success:true}` before the child parses; surface child exit-code/stderr into `backfill_jobs.status=FAILED` + `error`. Dashboard shows FAILED, not green. | L1 `runBackfill`, L7 job row | Kill the script → dashboard shows FAILED with the reason |
| **3** | **Close the gate blind-spot.** Extend `no-ts-js-twins` (or add `verify-script-syntax`) to `node --check` every `scripts/*.js` in CI. | `shared/tests/` | The bug cannot return |
| **4** | **One trigger path.** L7 publishes `SYSTEM_COMMANDS` instead of HTTP-calling L1; delete `ingestion:9101` call (rule 4). Add `BACKFILL_PROGRESS` to `REDIS_CHANNELS` in `shared/`. | L7 `SystemService`, `shared/constants.js` | Dashboard and Telegram triggers take the identical path |
| **5** | **Instruments from the DB.** Load the universe + tokens from `instruments` (+ `index_membership` for point-in-time), served by L7. **Fail closed** if a token is missing. Fixes GAP-I2. | L7 + L1 | Backfill of RELIANCE on MStock uses token **2885**, never Kite's 256265 |
| **6** | **Verify index tokens** (NIFTY/BANKNIFTY/INDIAVIX) — GAP-H1, owner action. Without these, "index history" fetches nothing. | `instruments` | A 1-day NIFTY backfill returns ~375 bars |
| **7** | **Range fan-out + work-units.** Expand `{from,to,universe}` → symbol×trading-day units; bounded-concurrency swarm; per-unit retry/resume; NSE holiday calendar. | L1 backfill worker | `from=X,to=Y` populates NIFTY + BANKNIFTY + 50 stocks |
| **8** | **Idempotent writes.** `ON CONFLICT DO NOTHING` on `candles_1m` + a regression test that re-running a range adds 0 rows. | L2/L3 writer | Row count unchanged on re-run |
| **9** | **Populate the coverage map.** Upsert `data_availability` per symbol after each unit (first/last/total/gaps/quality). | L1 → L7 | `/api/v1/data/availability` returns real ranges |
| **10** | **Live progress.** Publish per-unit progress → L7 relays to WS room `backfill`; dashboard shows a real progress bar + per-symbol status (this rides on the realtime work in `WIRING_GAPS_AND_FIXES.md` §3). | L1/L7/L8 | Progress bar advances without a page refresh |
| **11** | **Coverage grid + gap-fill button.** Symbol × month heat-map from `data_availability`; "Backfill gaps" wired to `/data/gaps`. | L8 | Holes visible at a glance; one click fills them |

**Fastest path to "it works again": steps 1 + 2.** Everything else is the redesign the owner asked for.

---

## 6. Acceptance criteria

1. `node --check` (or `tsx` load) passes for **every** script in `layer-1-ingestion/scripts/` — enforced in CI.
2. A dashboard backfill for a 1-day range writes rows to `candles_1m` and the job ends `COMPLETED`.
3. A **deliberately broken** script makes the job end **FAILED with the reason** — never a green "started".
4. `from=X, to=Y` with the default universe backfills **NIFTY + BANKNIFTY + 50 constituents**, 1-minute bars.
5. Re-running the same range inserts **0** additional rows (idempotent).
6. `GET /api/v1/data/availability` shows real `first_date`/`last_date`/`gaps` per symbol; the dashboard renders
   the coverage grid.
7. Progress is visible live (WS), with per-symbol status.
8. Backfill **fails loudly** on a missing instrument token — never substitutes another broker's tokens.

---

## 7. Hand-off

- **Do first:** steps 1–2 (the SyntaxError + the fake success). They are small and restore the feature.
- **Owner action:** GAP-H1 — verify MStock index tokens for NIFTY / BANKNIFTY / INDIAVIX; without them the
  index history (the headline requirement) silently returns nothing.
- **Depends on:** GAP-I2 (instrument map → DB) and the realtime wiring (§3 of `WIRING_GAPS_AND_FIXES.md`) for
  live progress.
- Register rows added as **GAP-L** in `docs/WIRING_GAPS_AND_FIXES.md` §0.
