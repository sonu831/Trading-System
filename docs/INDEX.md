# 📚 DOCUMENT INDEX — the map every AI tool reads first

> **Purpose:** ONE page that organizes every document in this repo — what it is, when to open it, and how much
> to trust it. Referenced from `.ai/ai-manifest.json` readOrder, so **all AI tools** (Claude, OpenCode, Copilot,
> Gemini, CommandCode, …) load the same map. Update THIS file whenever a doc is added/superseded.
> Trust: 🟢 active/authoritative · 🟡 partial (see note) · ⛔ stale/retired — never trust without re-verifying.

## 0. Start here (any new session, any tool)

| Order | File | What it gives you |
|---|---|---|
| 1 | `CLAUDE.md` (or your tool's spoke: `AGENTS.md` / `GEMINI.md` / `.github/copilot-instructions.md`) | The contract: 15 non-negotiable rules (graphify-first, shared-tier, fail-closed, …) |
| 2 | `.ai/MEMORY.md` | Canonical shared memory — decisions, topics, ⚡ ACTIVE WORK ORDER |
| 3 | `MEMORY.md` (root) | Working state snapshot |
| 4 | **`docs/INDEX.md`** (this file) | The document map |
| 5 | `.ai/handoffs/` (newest file) | Exactly where the last session left off — cross-AI relay baton |
| 6 | `graphify-out/` | Knowledge graph — the ONLY sanctioned codebase search entry |

## 1. The shared AI brain — `.ai/` (how tools share context)

| Path | Role |
|---|---|
| `.ai/ai-manifest.json` | 🟢 **HUB** — canonical rules/read-order/tools. Edit here → `npm run sync-ai` → propagates to all 6 tool spokes |
| `.ai/MEMORY.md` | 🟢 Canonical memory — every tool READS and APPENDS (decisions, contracts, active work) |
| `.ai/CONTRACT.md` | 🟢 Universal contract + agent coordination playbook |
| `.ai/skills/*.md` (7) | 🟢 Shared skills — reading the doc = having the skill. **`wiring-gaps.md` = the active work order skill** |
| `.ai/agents/*.md` (13) | 🟢 Specialist role docs (one per layer + devops/quality) |
| `.ai/handoffs/*.md` | 🟢 Session hand-offs — every tool writes one at session end (`YYYY-MM-DD-<topic>.md`) |
| `.ai/plans/` | 🟡 Feature plans (may be superseded by docs/ equivalents) |
| `CHANGELOG.md` (root) | 🟢 **The official project state** (per manifest `stateFiles.projectState`) |

## 2. ACTIVE WORK ORDER — implement in this order

| # | File | Role | Trust |
|---|---|---|---|
| ▶ | **`docs/MASTER_EXECUTION_PROMPT.md`** | THE paste-ready prompt chaining all phases 0–6 | 🟢 |
| 1 | **`docs/WIRING_GAPS_AND_FIXES.md`** | THE master work order: §0 gap register (41 gaps), §0.1 order, §3–§10 fixes, §6 acceptance | 🟢 |
| 2 | `docs/COCKPIT_BACKEND_PLAN.md` | Layer/data-source map (§1–§3) | 🟡 §4–§5 superseded by wiring doc |
| 3 | `docs/COCKPIT_INTEGRATION_AUDIT.md` | 17-tab screen→API mapping | 🟢 |
| 4 | `docs/design/FULL_COCKPIT_DESIGN_PROMPT.md` | Frontend design spec (17 tabs, laws, components, states) | 🟢 |
| 5 | `docs/design/mockups/cockpit-app.html` | Interactive visual reference (open in browser) | 🟢 |
| 6 | `docs/PREDICTIVE_MODEL_BUILD_PROMPT.md` | ML build phases 0–6 (P0 edge-study GATE first) | 🟢 |

## 3. Domain & architecture (open when the phase touches them)

| File | What | Trust |
|---|---|---|
| `VISION.md` · `ARCHITECTURE.md` | What the system is for; the three planes | 🟢 |
| `docs/MOMENTUM_TRADING_ARCHITECTURE.md` | Momentum module: tiers T1–T3, regime engine, strategy framework, §3.11 predictive model (+ edge-reality corrections) | 🟢 |
| `docs/OPTIONS_SCALPING_RULES.md` | Scalping hot-path authority (L10) | 🟢 |
| `docs/BROKER_LOGIN_FLOWS.md` | Per-broker auth flows (MStock Type B TOTP, FlatTrade, Kite) | 🟢 |
| `docs/DATABASE_SCHEMA.md` | DB schema reference (cross-check with L3 migrations — SQL is DDL authority per wiring doc F1) | 🟡 verify vs migrations |
| `docs/RESEARCH_PLANE_PLAN.md` | Research plane plan (added by concurrent session — **not audited**; reconcile with PREDICTIVE_MODEL_BUILD_PROMPT before acting) | 🟡 |
| `docs/broker-credential-ui.md` · `.ai/plans/broker-credential-ui.md` | Broker credential UI plan (largely built) | 🟡 mostly done |
| `docs/design/Auto-Trading-v1/` | THE design system: tokens, 15 components, guidelines, UI kit, `SKILL.md` | 🟢 |

## 4. Ops & contributor reference

| File | What |
|---|---|
| `DEPLOYMENT.md` · `CONTRIBUTING.md` · `README.md` | Deploy, conventions, entry |
| `EXPOSURE_GUIDE.md` | (root) exposure guide — not audited this session |
| `shared/constants.js` (+ `TOPICS.md`, `types.ts`) | Single source of truth: topics, Redis keys/channels, ports, enums |
| `Makefile` | All orchestration (`make help`) |

## 5. ⛔ Stale / retired — do NOT trust (rule 12)

| File | Why |
|---|---|
| `PROJECT_STATE.md` (root) | Retired: historically claimed features worked that crashed on run. Project state = `CHANGELOG.md`. Keep only as history |
| `docs/RESTRUCTURE_PLAN.md` | P0 done; P1–P3 items still open but folded into the wiring-doc register |
| Any doc's completion claim | Verify by execution — run the layer verify suites before believing any "DONE" |

## How cross-AI sharing works here (the model)

```
                    ┌────────────────────────────────────────────┐
                    │  HUB: .ai/ai-manifest.json  (rules, order) │
                    └───────────────┬────────────────────────────┘
                          npm run sync-ai (propagates)
      ┌──────────┬──────────┬──────┴─────┬──────────────┬─────────────┐
      ▼          ▼          ▼            ▼              ▼             ▼
  CLAUDE.md  AGENTS.md  GEMINI.md  copilot-instr.  opencode.json  commandcode
      └──────────┴──────────┴──────┬─────┴──────────────┴─────────────┘
                                   ▼   every tool then shares BY PATH:
        .ai/MEMORY.md (append-only memory) · docs/INDEX.md (this map) ·
        .ai/skills/ (capabilities) · .ai/handoffs/ (session baton) ·
        graphify-out/ (code knowledge) · CHANGELOG.md (state) · shared/ (contracts)
```

**Rules that keep it working:** every session ENDS by (1) updating `CHANGELOG.md`, (2) appending durable
decisions to `.ai/MEMORY.md`, (3) writing `.ai/handoffs/YYYY-MM-DD-<topic>.md`, (4) `graphify update .`,
(5) updating THIS index if documents changed. That is the entire cross-AI memory protocol.
