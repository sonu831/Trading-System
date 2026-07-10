# Hand-off — 2026-07-10 Recovery + Consolidation

**Author:** Claude (Opus 4.8), driven by owner Yogendra.
**For:** DeepSeek / OpenCode / any AI tool or engineer resuming this repo.
**Read `VISION.md` + `ARCHITECTURE.md` first, then this.**

---

## TL;DR

The repo was **unbootable** at the start of this session. Commit `7c2f6ea "fixed build path"` had
deleted 15,600 lines (119 files still missing), every Node layer's `main` pointed at a `src/index.js`
that no longer existed, and every `verify` gate crashed on `MODULE_NOT_FOUND`. It is now booting and
tested. Along the way, several defects that had been *hiding behind broken tests* surfaced and were
fixed with named regressions.

**Do NOT re-do any of the "Done" items below — they are verified by execution.**

---

## Done (verified by running it, not by document)

| Area | What | Proof |
|------|------|-------|
| Recovery | Restored 119 files deleted by `7c2f6ea` | files present; layers boot |
| shared/ | One canonical `constants.js` (+ `constants.d.ts`), deleted the `.ts` twin that shadowed it; `index.js` + `index.d.ts` likewise | `node shared/tests/constants-parity.test.js` (Node↔Go), `no-ts-js-twins.test.js` |
| L1 | tsx toolchain, deleted 4 `.ts/.js` twins, fixed `nextWeeklyExpiryIST` (ISO-vs-JS weekday, `isoToJsDay`) | `pnpm run verify` exit 0 |
| L2 | tsx; fixed **empty** `checkBoundaries()` (candles never closed without a next tick); pinned real (non-idempotent) dedup behaviour | `pnpm test` 6/6 |
| L6 | fixed `computeTFAlignment` — divided by trending TFs only, so 1-of-4 scored ~0.999 | `pnpm test` 13/13 |
| L10 | **restored `PositionManager.checkExits()`** (the whole exit engine had been deleted by the migration); fixed `PaperExecutor` closing every trade at entry for synthetic +25%; fixed E1 CE-vs-PE (bearish bought a CALL); tick-size rounding (off-tick stop → exchange reject → unprotected position) | `pnpm run verify` 91/91 |
| L7 | tsx + Prisma-6; fixed `secondsUntilISTHour` ReferenceError; MStock auth: envelope `.data.data`, echoed-token guard, interactive OTP without a 2nd SMS, token redaction (`token_length`) | `pnpm run verify:broker-auth` 70/78 |
| Toolchain | pnpm-only (npm lockfiles deleted, `pnpm-lock.yaml` un-gitignored — CI installed against an ignored file, so **CI never ran a test**); Node 24; tsx not ts-node; per-layer `pnpm-workspace.yaml` (`allowBuilds:`); backtest harness → `.ts` | installs clean; `pnpm test` green |
| DB | **Migration 007**: `candles_1m` retention 30d→5y; point-in-time `index_membership` + `index_members_asof()` | applied to live `timescaledb`; survivorship scenario proven |
| Backtest | `OptionSimulator` stamped `synthetic: true` (Black-Scholes @ const 15% IV); metrics carry the flag | `scripts/backtest` `pnpm test` 6/6 |
| Docs | 16 docs → `VISION.md` + `ARCHITECTURE.md` + 6 reference docs; 14 stale/contradictory planning docs deleted (~7,900 lines); manifest rule 15 (toolchain) added + `sync-ai` propagated to all 6 tool configs | — |

---

## NOT done — pick up here (priority order)

### P0 — finishing what's proven-broken
1. **L7 broker auth: 8 of 78 still failing** (`pnpm run verify:broker-auth`). Failing groups:
   FlatTrade jKey path (F), Kite checksum, background-refresh (H2). The MStock path (A–D) is fully
   green — use it as the template. NOTE: a concurrent editor refactored `mstock.ts` to an **adapter
   pattern** (`getAdapter`, `deps.adapter`) mid-session; re-run before assuming the failure list.
2. **L7 execution-proxy verify** (`verify:execution-proxy`) not yet re-run after the tsx switch.
3. **`pnpm run typecheck` fails in every TS layer.** The `.js→.ts` migration renamed files without
   ever running `tsc` (101 errors in L2 alone: `Cannot redeclare 'logger'`, implicit any). Runtime
   works via tsx (types stripped). This is real debt — pay it down layer by layer; do NOT relax
   `strict` to fake it.

### P1 — the vision's missing substrate (nothing intelligent works without this)
4. **Backfill service + the API modules the dashboard already calls.** `/api/v1/data/availability`,
   `/api/v1/data/stats`, `/api/v1/system/backfill/*` are called by the L8 Backfill UI but **do not
   exist** — six of seven `layer-7-core-interface/api/src/modules/*` dirs are empty. Build the
   `data` + `system` modules.
5. **`index_membership` loader.** Table ships empty (correct — no fabrication). Load real NSE
   historical constituents so `index_members_asof()` returns data.
6. **5-year historical backfill** into `candles_1m` (retention now allows it).

### P2 — the actual product
7. **k-NN analog engine** per `docs/RESEARCH_PLANE_PLAN.md` — feature/shape vectors, analog index,
   empirical-outcome query. This is the reason the project exists; it has no code yet.

### P3 — deferred upgrades
8. **Prisma 7** (pinned to 6). v7 removes `url` from the schema datasource and needs a driver adapter
   passed to `PrismaClient` + the new `prisma-client` generator.
9. **`shared/` import path wart.** Docker mounts at `/app/shared`; local checkout is repo-root
   `shared/`. A relative path that resolves in one breaks the other. `ist-time.ts` uses a
   `try(/app/shared) catch(../../../shared)` shim. Proper fix: a `@shared` tsconfig path alias +
   resolver, or publish `shared` as a workspace package.

---

## ⚠️ Environmental hazard — a concurrent editor

Something (another AI tool or an IDE/linter action) **edits files in this workspace in parallel.**
Observed this session:
- Resurrected `shared/constants.ts` **three times** after deletion (the `no-ts-js-twins` gate now
  catches it — run it after any pull).
- Rewrote `layer-2-processing/tsconfig.json` to `strict: false`, deleting the comment forbidding it.
- Changed `ist-time.ts`'s shared require path from `../../../shared` to `../../shared` (Docker-correct,
  local-broken) — this broke L1 until re-fixed with the shim.
- Refactored `mstock.ts` to an adapter pattern.

**Before trusting any file, re-run its verify gate.** If `strict: false` reappears in a tsconfig,
that is the other editor, not intent.

---

## How to verify everything is still green (copy-paste)

```bash
node shared/tests/constants-parity.test.js && node shared/tests/no-ts-js-twins.test.js
node scripts/verify-docker-hygiene.mjs
( cd layer-1-ingestion  && pnpm run verify )
( cd layer-2-processing && pnpm test )
( cd layer-6-signal     && pnpm test )
( cd layer-10-execution && pnpm run verify )   # 91 asserts
( cd layer-7-core-interface/api && pnpm run verify:broker-auth )  # 70/78 expected
( cd scripts/backtest   && pnpm test )
# Go layers (L4/L5) were NOT run this session — no Go toolchain locally. Run `go test ./...`.
```

## Hand-off

- **Next tool:** start at P0.1 (L7 auth 8 fails) or P1.4 (build the `data`/`system` API modules the
  dashboard already calls) — both unblock visible product.
- **Owner decisions still open:** which NSE historical-constituents source to load into
  `index_membership`; whether to keep Prisma 6 or invest in the v7 adapter migration; the `@shared`
  path-alias approach.
- **Not pushed:** everything is staged/working-tree only; no git commit or PR was created (rule 9).
