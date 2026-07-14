# Hand-off — 2026-07-11 — Wiring Audit, Gap Register & Execution Planning

> **Session:** Claude Code (Fable 5). **Branch:** `nifty-trading-plan`. **Nothing committed** (rule 9) — all work staged.
> **Next session (any tool): read `docs/INDEX.md` → `docs/MASTER_EXECUTION_PROMPT.md` → start PHASE 0.**

## What this session produced (all verified against code, not docs)

1. **`docs/WIRING_GAPS_AND_FIXES.md`** — THE active work order. §0 = master register of **41 gaps** (wiring A/B/C/D,
   broker E1–E6, DB F1–F8, frontend G1–G5, predictive P0–P6, owner H1, enhancements R1–R14) with statuses;
   §0.1 = execution order; §3–§10 drafted fixes; §6 acceptance (incl. `scripts/verify-wiring.js` gate — not yet built).
2. **`docs/MASTER_EXECUTION_PROMPT.md`** — one paste-ready prompt chaining all docs, phases 0–6.
3. **`docs/INDEX.md`** — master document map with trust levels (registered in manifest readOrder).
4. **`.ai/skills/wiring-gaps.md`** — strict working rules; synced to all 6 tool spokes (`npm run sync-ai`: 7 skills).
5. Doc updates: `MOMENTUM_TRADING_ARCHITECTURE.md` §3.11 (predictive model + edge-reality corrections),
   `PREDICTIVE_MODEL_BUILD_PROMPT.md` (Phase-0 gate, survivorship, costs), `COCKPIT_BACKEND_PLAN.md` (stale banner),
   `docs/design/FULL_COCKPIT_DESIGN_PROMPT.md` (17-tab spec), `docs/design/mockups/cockpit-app.html` (visual reference),
   CHANGELOG entries, `.ai/MEMORY.md` ⚡ ACTIVE WORK ORDER section.
6. Frontend restructure Phases 1–2 SHIPPED earlier in session: `ui/`≡atoms deduped (typed), `molecules/` extracted
   (Modal/Table/DataTable/Carousel), 6 importers updated, old `atoms/` deleted.

## Key verified facts the next AI must NOT re-derive

- **REST plane complete:** all ~20 frontend adapters in `src/api/index.ts` have live L7 routes (incl. /alerts,
  /backtest, /predict, /strategies, /risk/config, /options/*, /execution/orders). All cockpit pages exist.
- **Realtime mostly dead:** two competing WS relays (`plugins/websocket.ts` + `services/SocketService.ts`);
  no publishers for `market_ticks`/`option_chain_updates`/`execution:state`/`execution-events`;
  `signals`≠`signals:trade`; `notifications`≠`notifications:execution`; only `market-regime` live.
- **Commands without consumers:** `strategies-changed`, `risk-changed` (safety). `providers-changed` = working pattern.
- **Broker:** no session refresh loop; silent IST-midnight expiry; status may be presence-not-liveness.
- **🟣 P4 SAFETY (Phase 0):** L9 `pytorch_engine.py` returns hardcoded 0.65 dummy; L7 `/api/v1/predict` proxies it
  → UI can render a fabricated prediction TODAY. Fix = explicit abstain. Do this FIRST.
- **🟣 G6 SAFETY (Phase 5, do first within it):** cockpit pages render MOCKUP DUMMY DATA as if live — organisms
  carry mockup numbers as default props (`AdvanceDeclineBar({ advancing = 38, declining = 12, adRatio = 3.17 })`)
  and pages render them propless (`internals.tsx`). The typed adapters in `src/api/index.ts` exist but pages
  bypass them (`predictions.tsx` fetches inline — the one page that IS wired). Detailed fix prompt:
  `docs/WIRING_GAPS_AND_FIXES.md` §0.2. Acceptance: backend stopped ⇒ only skeletons/`—`/STALE, never 38/12/74/3.17.
- **DB:** `index_membership` table exists (007) but population/consumption unverified; SQL migrations = DDL
  authority, Prisma must stay introspect-only (F1 drift gate).

## Open verifications (🟠 in register)

B6 (L5 Go publishes `market_view`?), E3 (status handler liveness), E5 (kite.ts completeness), F2–F6 (DB items),
`docs/RESEARCH_PLANE_PLAN.md` (created by a concurrent session — not audited; reconcile with the predictive prompt).

## Environment notes

- `rtk` binary NOT installed despite contract rule 2 — run commands without it.
- A concurrent editor (CommandCode) modifies files mid-session — **re-verify any file you read earlier before editing**.
- PreToolUse hook blocks grep/glob unless graphify ran first in the session.

## Hand-off

- Start `docs/MASTER_EXECUTION_PROMPT.md` PHASE 0 (P4 abstain hotfix), then PHASE 1 (wiring §4 step 1: `REDIS_CHANNELS`).
- Flip register statuses in `docs/WIRING_GAPS_AND_FIXES.md` §0 as gaps close; CHANGELOG + handoff on exit.
- Owner decisions pending: alerts-channel convention (B4), MStock index tokens (H1).
