# Skill: Graphify Knowledge Graph

> **Shared skill for ALL AI tools and agents.** How to use the AST knowledge graph
> for codebase navigation. This is the FIRST tool to reach for -- before grep, Glob,
> or find.

## Rule: Graphify-first (non-negotiable)

**Before any `grep`, `Glob`, or `find`, always run `graphify query` or `graphify explain`.**
The graph is faster and more accurate than text search for understanding relationships,
callers, and imports across the whole codebase. Grep is allowed only as a one-shot
**verification** of a graphify finding -- never as the primary scan.

## The 4 Commands

```bash
# 1. Start here -- concept/keyword search, returns ranked nodes + edges
graphify query "<concept>"
# Examples:
#   graphify query "Kafka producer tick"
#   graphify query "RSI calculation"
#   graphify query "WebSocket real-time"

# 2. Deep-dive on one symbol -- definition, all neighbors, cited files
graphify explain "<symbol-or-file>"
# Examples:
#   graphify explain "NormalizedTick"
#   graphify explain "layer-4-analysis/main.go"

# 3. Trace the dependency path between two symbols
graphify path "<A>" "<B>"
# Examples:
#   graphify path "raw-ticks" "market_candles"
#   graphify path "CandleBuilder" "IndicatorEngine"

# 4. Refresh the graph after editing code (run this EVERY TIME you change a file)
graphify update .
```

## Graph Location

```
graphify-out/
├── graph.json          # Full AST knowledge graph -- nodes + edges
├── GRAPH_REPORT.md     # Human-readable summary: communities, top nodes, stats
├── manifest.json       # Node inventory with file paths and line numbers
└── cache/              # Incremental update cache
```

## If the CLI Is Sandbox-Blocked

Read the pre-built output files directly:
1. **`graphify-out/GRAPH_REPORT.md`** -- community clusters, top-degree nodes, key files
2. **`graphify-out/manifest.json`** -- flat inventory of every node

## After Editing Code

Always run: `graphify update .`

This keeps the graph current so the next query reflects your changes.
