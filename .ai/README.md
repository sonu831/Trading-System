# `.ai/` -- AI Tool Hub

> Central hub for all AI tools working on this project. One source of truth, synced to every tool.

## Structure

```
.ai/
├── ai-manifest.json     # CANONICAL source of truth -- edit this, then sync
├── CONTRACT.md           # Universal AI Contract -- rules all tools must follow
├── MEMORY.md             # Canonical memory -- architecture, decisions, conventions
├── README.md             # This file
├── agents/               # Specialist agent definitions (12 agents)
│   ├── market-strategist.md
│   ├── system-architect.md
│   ├── ingestion-specialist.md
│   ├── processing-engineer.md
│   ├── storage-engineer.md
│   ├── technical-analyst.md
│   ├── sentiment-aggregator.md
│   ├── signal-engineer.md
│   ├── api-gateway-engineer.md
│   ├── presentation-specialist.md
│   ├── ai-ml-engineer.md
│   ├── devops-engineer.md
│   └── quality-gatekeeper.md
├── skills/               # Shared skills (tool-agnostic)
│   ├── graphify.md       # Knowledge graph usage
│   ├── tradingview.md    # TradingView MCP chart analysis
│   ├── kafka-patterns.md # Kafka producers/consumers
│   ├── database.md       # TimescaleDB + Redis operations
│   └── docker.md         # Docker Compose orchestration
├── plans/                # Implementation plans
├── handoffs/             # Inter-agent handoff notes
└── tools/                # Per-tool configurations
    ├── opencode/opencode.json
    ├── commandcode/settings.json
    └── claude/
```

## How to use

### Human (editing rules)
1. Edit `.ai/ai-manifest.json` to change rules, read order, or add skills
2. Run `npm run sync-ai` (or `make sync-ai`) to propagate to all tool spokes
3. Run `npm run sync-ai-check` (or `make sync-ai-check`) to verify no drift

### AI Tool (starting a session)
1. Read `CLAUDE.md` first
2. Read `.ai/MEMORY.md` for canonical memory
3. Read `.ai/CONTRACT.md` for non-negotiable rules
4. Read relevant `.ai/skills/*.md` for your task
5. Use `graphify query/explain/path` for codebase navigation

### Sub-Agent (specialist work)
1. Read `.ai/agents/<your-name>.md` for domain guidance
2. Follow the Universal AI Contract in `.ai/CONTRACT.md`
3. Update CLAUDE.md with your work before ending

## Update Protocol

After every non-trivial session, update:
1. CLAUDE.md "Active Knowledge State" (mandatory)
2. MEMORY.md (if working state changed)
3. `.ai/MEMORY.md` (if architecture/convention changed)

## Sync Commands

```bash
npm run sync-ai         # Propagate ai-manifest.json to all tool spokes
npm run sync-ai-check   # Verify no drift (CI gate)
make sync-ai            # Same via Makefile
make sync-ai-check      # Same via Makefile
```
