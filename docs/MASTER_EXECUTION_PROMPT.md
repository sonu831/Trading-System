# Master Execution Prompt — Implement All Gaps (paste into any AI session at repo root)

> Copy everything below the line into a fresh Claude Code / AI session opened at the repo root.
> It chains all planning documents in the correct order with acceptance criteria per phase.

---

## PROMPT (copy from here)

You are implementing the remediation plan for the **Trading-System** monorepo (Nifty-50 algorithmic trading
platform: dashboard = trigger point, L7 backend API = single command plane, 10 event-driven layers).
All planning is DONE and documented — your job is to execute it in order. Do not re-plan, do not re-audit
what the documents already verified; re-verify only what they mark 🟠 VERIFY.

### Read first, in this order
1. `CLAUDE.md` + `.ai/MEMORY.md` (project contract — non-negotiable rules 1–15, incl. the ⚡ ACTIVE WORK ORDER)
2. `.ai/skills/wiring-gaps.md` (strict working rules for this exact work)
3. `docs/WIRING_GAPS_AND_FIXES.md` — **THE master document**: §0 Master Gap Register (41 gaps, IDs A…R),
   §0.1 execution order, §3–§10 drafted fixes, §6 acceptance criteria
4. Supporting references (open when their phase starts): `docs/COCKPIT_BACKEND_PLAN.md` (§1–§3 layer/data map
   only — §4–§5 are superseded), `docs/COCKPIT_INTEGRATION_AUDIT.md` (screen→API), `docs/MOMENTUM_TRADING_ARCHITECTURE.md`
   (domain rules, §3.11), `docs/design/FULL_COCKPIT_DESIGN_PROMPT.md` + `docs/design/mockups/cockpit-app.html`
   (frontend target), `docs/PREDICTIVE_MODEL_BUILD_PROMPT.md` (ML phases)

### Non-negotiable working rules (violations = contract breach)
- **graphify for EVERY codebase query** (`graphify query/explain/path`); grep/glob only as one-shot verification
  after graphify; `graphify update .` after every edit.
- **Every channel/room/topic/key/enum name comes from `shared/constants.js`** — never a string literal in a layer.
- **Fail closed / never fabricate** — missing data ⇒ abstain/null/`—`, never 0 or a false CONNECTED.
- **Verify by execution** — a fix is done only when its named assertion passes; run the layer verify suites
  (`pnpm run verify` in layer-10 and layer-7/api, `pnpm test` in layer-2/layer-6, `node shared/tests/constants-parity.test.js`).
- **No git commit/push/branch** unless I explicitly ask; leave work staged. pnpm + Node 24 + tsx (never ts-node).
- **After each phase:** flip the closed gaps' statuses in the §0 register, add a CHANGELOG line, end your report
  with a `## Hand-off` section.

### Execute these phases IN ORDER

**PHASE 0 — Safety hotfix (do first, ~1 file).** Gap **P4** (🟣): `layer-9-ai-service/app/engines/pytorch_engine.py`
returns a hardcoded 0.65/0.70 dummy and L7 `/api/v1/predict` proxies it — a fabricated prediction the UI can
render. Make L9 return an explicit no-prediction/abstain result (distinguish "model unavailable" from "FLAT"),
make the L7 proxy pass the abstain through, and verify the predictions page renders its "model unavailable" state.
✅ Accept: `/api/v1/predict` never returns a numeric prediction while no trained weights exist; a test asserts it.

**PHASE 1 — Realtime wiring.** `docs/WIRING_GAPS_AND_FIXES.md` §4 steps 1–4 + §5. Gaps A, B1–B6, D1–D2:
add `REDIS_CHANNELS` to `shared/constants.js`; collapse to ONE WS relay (dedicated Redis subscriber, canonical
rooms `ticks/chain/regime/positions/execution/alerts/breadth/signals`, delete the losing implementation); fix the
`signals:trade` and alerts-channel mismatches; light the missing publishers (L1 ticks + chain, L10 state/events/alerts,
verify L5 Go breadth). Build `scripts/verify-wiring.js` (§4 step 8) with one named assertion per wire.
✅ Accept: doc §6 items 1, 2, 6 — verify-wiring green, one relay, no string-literal channel names.

**PHASE 2 — Broker sessions.** Doc §9, gaps E1–E6: session monitor loop (auto re-auth when unattended possible,
actionable alert otherwise), liveness probe on provider status (`last_validated_at`, no false green), single-flight
auth lock, morning-connect UI checklist, TOTP server-time check, session events on the alerts channel.
✅ Accept: doc §6 item 4 + a simulated expiry produces an alert and (where possible) auto re-auth; status shows
UNVERIFIED/EXPIRED when the probe fails.

**PHASE 3 — Command fan-out.** Doc §3 GAP-C (+§4 step 5): L6 consumes `strategies-changed` (hot-reload registry),
L10 consumes `risk-changed` (hot-swap limits, never silently loosen with open positions), both ack + log.
Replicate the working `providers-changed` pattern.
✅ Accept: doc §6 item 3 — PATCH changes behavior without restart, observed by log/ack.

**PHASE 4 — Database.** Doc §10, gaps F1–F8 in order: F1 ownership + CI drift gate (SQL migrations = DDL authority,
Prisma introspect-only) → F2 populate + consume `index_membership` → F3 verify-then-add control-plane tables
(migration 008) → F4 writer ON CONFLICT audit → F5 attribution columns (request_id/strategy_id/regime) →
F6 aggregate ladder → F7 job-health surfacing → F8 restore drill target.
✅ Accept: each F row's fix column; drift gate green in CI.

**PHASE 5 — Frontend.** Gaps G1–G6 — **do G6 FIRST, it is 🟣 SAFETY**: pages render mockup dummy values via
default props (e.g. `AdvanceDeclineBar({ advancing = 38 … })` rendered propless in `internals.tsx`) — follow the
detailed fix prompt in `docs/WIRING_GAPS_AND_FIXES.md` §0.2 (strip market-data prop defaults, wire pages through
the existing `src/api/index.ts` adapters + `useSocket` rooms, add loading/stale/empty states; acceptance: backend
stopped ⇒ only skeletons/`—`/STALE, never a mockup number). Then G1–G5, using `docs/design/FULL_COCKPIT_DESIGN_PROMPT.md` as the spec and
`docs/design/mockups/cockpit-app.html` as the visual reference: AppShell + grouped sidebar (Trade/Analyze/Configure/
Operate) replacing the 5-button Navbar; codemod raw Tailwind palette classes to semantic tokens + ESLint ban;
finish atoms/molecules/organisms reclassification (features/, domain folders, root strays); fix the 3 stale README
examples; start the `@ts-nocheck` ratchet (ban new, burn down old).
✅ Accept: design prompt §A laws hold; both themes work on every page; lint gates green.

**PHASE 6 — Predictive model (GATED).** `docs/PREDICTIVE_MODEL_BUILD_PROMPT.md`, gaps P0–P6: run **Phase 0**
(survivorship-safe daily breadth study, point-in-time constituents, net of costs, walk-forward). **STOP and report
the result to me.** Only proceed to Phases 1–6 of that document if a stable post-cost edge exists. P6 (heavyweight
`contributions[]` in L5 market_view) may be done any time — it also feeds the /internals screen.
✅ Accept: that doc's "Acceptance criteria" section; promotion to live influence is human-gated.

**Weave throughout (from doc §8):** correlation IDs (R1) and heartbeats/staleness (R2) belong inside Phases 1–3,
not after; add DLQ/outbox/breakers (R3–R5) opportunistically where you touch the code paths.

### Report format per phase
1. What closed (gap IDs) + evidence (test names, verify output). 2. Register statuses flipped. 3. CHANGELOG line
added. 4. Anything discovered that contradicts the docs (update the doc, don't silently diverge). 5. `## Hand-off`.

Start now with PHASE 0.

## (end of prompt)
