# `.ai/CONTRACT.md` -- The Universal AI Contract

> **Every AI tool and every sub-agent inherits this contract.** Same skills, same pattern, same memory, same rules. Read first, every session.

## 0. Read order -- every session, every tool

1. [`CLAUDE.md`](../CLAUDE.md) -- project rules, architecture, active state
2. [`.ai/MEMORY.md`](MEMORY.md) -- canonical memory (architecture decisions, conventions)
3. **This file** (`.ai/CONTRACT.md`)
4. If you are a sub-agent: your own agent doc at [`.ai/agents/<your-name>.md`](agents/)
5. If your task uses a shared skill: the relevant [`.ai/skills/*.md`](skills/) doc

## 1. Non-negotiable project rules

| # | Rule | What it means for you |
|---|------|----------------------|
| 1 | **Graphify-first** | Before any `grep`/`find`/`Glob`, run `graphify query "<concept>"` or `graphify explain "<symbol>"`. Grep is for verifying a graphify finding, never the primary scan. |
| 2 | **RTK for all commands** | Prefix every shell command with `rtk` -- 60-90% token savings. |
| 3 | **Shared-tier dedup** | Search `shared/` first before declaring any cross-layer constant/enum/type/Kafka-topic. |
| 4 | **Event-driven contracts** | Layers talk only via Kafka. Consumers must be idempotent. Schemas in shared/. |
| 5 | **CQRS access pattern** | Redis for reads, TimescaleDB for writes. Repository pattern. `ON CONFLICT DO NOTHING`. |
| 6 | **No hardcoded secrets** | All secrets from env vars. Never commit .env files. |
| 7 | **PR workflow** | Feature branches -> PR into main. Conventional commits. |
| 8 | **Language conventions** | ESLint/Prettier for JS. gofmt for Go. Black/ruff for Python. |
| 9 | **No git writes** | Don't commit/push/push unless explicitly asked. |
| 10 | **Hand-off on exit** | Every report ends with `## Hand-off` section. |

## 2. State-file boundary

| File | Lifecycle | Update when | Owned by |
|------|-----------|-------------|----------|
| [`CLAUDE.md`](../CLAUDE.md) | Rarely changes | Architecture / rule / tier-boundary changes | Architect agent + human |
| [`.ai/MEMORY.md`](MEMORY.md) | Slow | Architecture decisions, tool/config, stable conventions | Any AI making a durable decision |
| [`MEMORY.md`](../MEMORY.md) | Fast | Working state: current task, active bugs, session context | Session owner |

**Rule of thumb:** If it's a forever decision, write to `.ai/MEMORY.md`. If it's today's working state, write to `MEMORY.md`.

## 3. Update Protocol -- update CLAUDE.md before ending

**Every AI tool, every sub-agent, every non-trivial session, MUST update CLAUDE.md "Active Knowledge State"** before ending. This prevents the next session from re-doing your work.

### What counts as "non-trivial"
- Any code change beyond a typo
- Any new file
- Any decision the next session would not re-derive
- Any architecture change
- Any agent / shared-rule update
- Reading + reporting without changing state (no update needed)

## 4. Hand-off section

Every report ends with:
```markdown
## Hand-off
- **AgentName:** task description
- **Human:** decision needed on X
```

If no hand-offs: `## Hand-off\n\n- None.`

## 5. Same skills -- `.ai/skills/`

Every AI tool uses the same shared-skills set:

| Skill | File | When to use |
|-------|------|-------------|
| Knowledge graph | `skills/graphify.md` | Every codebase scan (mandatory per #1) |
| TradingView MCP | `skills/tradingview.md` | Chart analysis, indicator work, Pine Script |
| Kafka event patterns | `skills/kafka-patterns.md` | Adding/modifying Kafka producers/consumers |
| Database operations | `skills/database.md` | TimescaleDB/Redis schema changes, queries |
| Docker compose | `skills/docker.md` | Infrastructure, service orchestration |

## 6. Same memory -- `.ai/MEMORY.md` is canonical

`.ai/MEMORY.md` is the single source of truth for architecture decisions, tool config, naming conventions, env-var contracts.

**Rule:** If Claude and another tool disagree, Claude wins.

## 7. Codebase scanning rule (graphify-first)

```bash
graphify query "<concept>"              # broad concept search
graphify explain "<symbol-or-file>"     # single node: definition, neighbors
graphify path "<A>" "<B>"              # shortest dependency path
graphify update .                       # ALWAYS run after modifying code
```

## 8. Layer boundaries

```
L1 Ingestion    (Node.js/Python)     -> Kafka raw-ticks
L2 Processing   (Node.js)            -> Kafka market_candles
L3 Storage      (TimescaleDB+Redis)  -> persistence
L4 Analysis     (Go)                 -> Kafka analysis_updates
L5 Aggregation  (Go)                 -> market-wide sentiment
L6 Signal       (Node.js)            -> buy/sell decisions
L7 Core API     (Node.js/Fastify)    -> REST + Socket.io
L8 Presentation (Node.js/React)      -> Telegram, web, email
L9 AI Service   (Python)             -> ML inference
```

Cross-layer rules:
- Layers communicate ONLY via Kafka topics
- API layer is stateless across requests
- Signal layer reads from aggregation, writes to Kafka
- Storage layer is accessed via repository interfaces only

## 9. Agent roster

See [`.ai/agents/`](agents/) for 12 specialist agents:

| Phase | Agents |
|-------|--------|
| Strategy + Architecture | market-strategist, system-architect |
| Data Pipeline | ingestion-specialist, processing-engineer, storage-engineer |
| Analysis + Signals | technical-analyst, sentiment-aggregator, signal-engineer |
| Interface + Delivery | api-gateway-engineer, presentation-specialist, ai-ml-engineer |
| Quality + Ops | quality-gatekeeper, devops-engineer, security-auditor |

## 10. What every AI does NOT do

- Do **not** run `git commit`, `git push` unless explicitly asked
- Do **not** add new dependencies without justification
- Do **not** edit files outside your declared domain
- Do **not** mask test failures
- Do **not** introduce magic numbers/strings -- use shared/ constants
- Do **not** skip the Update Protocol (#3)

## 11. When you fail / get stuck

End with a `## Hand-off` section listing the blocker and which agent can unblock. Don't silently abandon.

## 12. Conformance checklist

A session is contract-compliant if:
1. Used graphify before any grep/find (or none was needed)
2. Searched shared/ before declaring any cross-layer symbol
3. Followed event-driven patterns for inter-layer communication
4. Used CQRS for database access
5. Updated CLAUDE.md at session end
6. Final report has Hand-off section
7. Did not commit/push without instruction
8. Did not introduce undeclared dependencies

> _Last updated: 2026-07-09. Owner: System Architect + human._
