# MEMORY.md — Working State

> **Session-level working memory.** Current focus, active tasks, recent changes. Fast-changing state.
> For durable decisions, see `.ai/MEMORY.md`. For architecture, see `CLAUDE.md`.

## Current Focus

- **AI workflow infrastructure** — hub-and-spoke config sync, 12 agents, 5 skills
- **Graphify knowledge graph** -- active, 4998 nodes, 5132 edges, 1354 communities

## Quick Commands

```bash
npm run sync-ai          # Propagate ai-manifest.json to all tool spokes
npm run sync-ai-check    # Verify no drift (CI gate)
graphify update .        # Refresh knowledge graph after code changes
graphify query "<concept>"  # Search codebase via knowledge graph
```

## Recent Work

| Date | What | Agent |
|------|------|-------|
| 2026-07-09 | Broker credential vault + provider registry implemented | system-architect |
| 2026-07-09 | Docker compose fixes (network, version-check, healthcheck) | devops-engineer |
| 2026-07-09 | AI workflow infrastructure initialized | system-architect |
| 2026-07-09 | **Momentum Module — Phases A–F built**: Data foundation (A), Regime Engine (B), Strategy Framework (C), Backtest + Optimizer (D), L10 Execution (E), Validation Roadmap (F). See `PROJECT_STATE.md` and `docs/MOMENTUM_TRADING_ARCHITECTURE.md` | opencode |

## Active Gaps / Known Issues

- None currently tracked.

## Environment

- **OS**: Windows (MSYS2/MinGW)
- **Shell**: PowerShell / Git Bash
- **Docker**: Desktop required for full stack
- **Node.js**: 18+ required
