# Skill: Wiring Gaps Work Order — ACTIVE (2026-07-11)

> **Trigger:** ANY work touching realtime (WebSocket/Redis pub-sub), L7↔layer commands, broker
> sessions/auth, or the TimescaleDB/Prisma schema. Read this BEFORE writing code in those areas.

## The one source of truth

**`docs/WIRING_GAPS_AND_FIXES.md`** is the active, code-verified work order for making the platform
robust (dashboard = trigger point, L7 backend API = single command plane, all layers commanded through it).
Do not re-derive its findings and do not trust older docs it marks stale (§7 trust map — notably
`COCKPIT_BACKEND_PLAN.md` §4–§5 is superseded; the old PROJECT_STATE.md is retired; CHANGELOG.md is the
project state per `.ai/ai-manifest.json`).

## Gap registry (work strictly in §4's order)

| Family | What | Where in doc |
|---|---|---|
| GAP-A | TWO competing WS relays (`plugins/websocket.ts` vs `services/SocketService.ts`), mismatched rooms | §3 |
| GAP-B | Dead/mismatched Redis pub-sub wires (`market_ticks`, `option_chain_updates`, `execution:state`, `execution-events` unpublished; `signals` vs `signals:trade`; `notifications` vs `notifications:execution`) | §3 |
| GAP-C | Command fan-out without consumers (`strategies-changed` → L6, `risk-changed` → L10) | §3 |
| GAP-D | Frontend room joins + staleness badges | §3 |
| GAP-E | Broker sessions: no refresh loop, silent expiry, presence≠liveness status, no auth single-flight, Kite daily flow | §9 |
| GAP-F | DB: dual schema authority (SQL vs Prisma), `index_membership` population, missing control-plane tables, writer idempotency, attribution columns, restore drill | §10 |
| R1–R14 | Robustness/troubleshooting enhancements (correlation IDs, heartbeats, DLQ, outbox, breakers, schema validation at boundaries, `verify-wiring --live`, runbooks, chaos drill) | §8 |
| GAP-G | Frontend: legacy taxonomies, no AppShell/sidebar, theme leaks (raw Tailwind classes), stale README examples, `@ts-nocheck` epidemic | §0 register G1–G5 |
| GAP-P | Predictive model: unproven edge (P0 gate), feature-contract mismatch, untrained stub. **P4 is 🟣 SAFETY: `/api/v1/predict` currently proxies a hardcoded 0.65 dummy — a fabricated value the UI can render (rule 13)** | §0 register P0–P6 + `docs/PREDICTIVE_MODEL_BUILD_PROMPT.md` |

**The master register + execution order live in doc §0/§0.1 — start at §4 step 1 (`REDIS_CHANNELS`); the P4
interim abstain fix may jump the queue.** Update a gap's status in §0 whenever you close one.

## Non-negotiables while working these

1. **Graphify for EVERY codebase query** (`graphify query/explain/path`) — grep/glob only as one-shot
   verification after graphify pointed at a symbol (contract rule 1). `graphify update .` after every edit.
2. **Names come from `shared/constants.js`** — add `REDIS_CHANNELS` there FIRST (doc §5); never string-literal
   a channel/room/topic/key in a layer (rules 3/14).
3. **One WS relay only.** Consolidate into one implementation with a dedicated Redis subscriber client; delete
   the loser. Never ship both.
4. **Every fixed gap = a named assertion** in `scripts/verify-wiring.js` (doc §4 step 8, acceptance §6).
   A fix without its assertion is not done (rule 12 — verify by execution).
5. **Fail closed, never fabricate** — dead wire ⇒ `STALE`/`—` on screen, abstain in APIs; never a confident 0
   or a false CONNECTED (rules 11/13).
6. **Report progress** by flipping the gap's status inside `docs/WIRING_GAPS_AND_FIXES.md` and adding a
   CHANGELOG line; end reports with a `## Hand-off` section (rule 10).
