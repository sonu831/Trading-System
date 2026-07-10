# Skill: Graphify Knowledge Graph — ABSOLUTE MANDATE

> **THIS IS THE SINGLE MOST IMPORTANT SKILL IN THIS PROJECT.**
> Every AI tool and agent MUST use graphify for EVERY codebase access — 100% of the time, zero exceptions, no bypassing.

## ⚠️ THE MANDATE (NON-NEGOTIABLE)

1. **graphify is the ONLY entry point to the codebase.** The knowledge graph (4,428+ nodes, 4,259+ edges) captures ALL architecture relationships, cross-layer dependencies, imports, calls, and file structures.

2. **Grep/find/Glob/ripgrep/Read as primary search is STRICTLY FORBIDDEN.** These tools may only be used as a ONE-SHOT VERIFICATION after graphify pointed you to a specific symbol or file.

3. **This applies to EVERY session, EVERY task, EVERY question — no exceptions.** Even if you think you know where something is, run graphify first.

4. **Run `graphify update .` after EVERY code modification** to keep the graph current.

## The 4 Commands

```bash
# 1. ALWAYS START HERE — concept/keyword search, returns ranked nodes + edges
graphify query "<concept>"
# Examples:
#   graphify query "Kafka producer"
#   graphify query "RSI calculation"
#   graphify query "WebSocket real-time"

# 2. Deep-dive on one symbol — definition, all neighbors, cited files
graphify explain "<symbol-or-file>"
# Examples:
#   graphify explain "NormalizedTick"
#   graphify explain "layer-4-analysis/main.go"

# 3. Trace the dependency path between two symbols
graphify path "<A>" "<B>"
# Examples:
#   graphify path "raw-ticks" "market_candles"
#   graphify path "CandleBuilder" "IndicatorEngine"

# 4. Refresh the graph after editing code (MANDATORY — run this EVERY TIME you change a file)
graphify update .
```

## Graph Location

```
graphify-out/
├── graph.json          # Full AST knowledge graph — nodes + edges
├── GRAPH_REPORT.md     # Human-readable summary: communities, top nodes, stats
└── cache/              # Incremental update cache
```

## If the CLI Is Sandbox-Blocked

Read the pre-built output files directly — do NOT fall back to grep:
1. **`graphify-out/GRAPH_REPORT.md`** — community clusters, top-degree nodes, key files
2. **`graphify-out/graph.json`** — raw graph data

## Enforcement

- PreToolUse hook blocks grep/find/Glob if graphify was not called first in the same session
- Code review rejects any PR where an AI clearly bypassed graphify
- Contract violation = session failure

**Remember: graphify is the map. Without it, you're working in the dark.**
