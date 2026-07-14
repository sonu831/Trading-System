# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Architecture
- Store all credentials and configuration in the database managed via dashboard UI, not in .env files. All layers including ingestion must authenticate via the API/dashboard, not from .env. Avoid Docker image rebuilds for credential changes. Confidence: 0.85
- For mstock provider: Store the JWT access token (from MConnect login response) in the database after initial login and reuse it for subsequent requests rather than re-authenticating each time. Confidence: 0.70

# Storybook
- Use Storybook 7.6.x (not 8.x+) with Next.js 13 Pages Router — 8.x has webpack version conflicts with Next.js 13's bundled webpack. Confidence: 0.75

# Architecture
- For Cockpit app: Use CSS custom property design system with semantic tokens (--color-background, --color-surface, --color-text-primary, etc.) supporting light/dark via data-theme attribute on :root. All components reference these tokens, never hardcoded colors. Confidence: 0.70
- For Cockpit app: Build with reusable atomic components (StatTile, Badge, Meter, Card, Gauge, SignalRow, etc.) composed into screen layouts. Extract shared UI patterns into components rather than repeating markup. Confidence: 0.70
- For Cockpit app: Encapsulate non-visual logic in custom hooks (e.g., useTheme, useKillSwitch, useClock, useScreenNavigation). Keep components focused on rendering, hooks on behavior. Confidence: 0.70

# Docker
- Always use `--project-name trading-system` on every `docker compose` command to prevent project name splits that cause port/network conflicts. Prefer `make` targets (which already include it) over raw docker commands. Confidence: 0.85
- Place scripts that need to run inside the ingestion container under `layer-1-ingestion/scripts/`, not repo-root `scripts/`. The ingestion Dockerfile build context is `layer-1-ingestion/`, so repo-root scripts won't be copied into the image. Confidence: 0.70
- All containers must share a single Docker network (`local-trading-network`). Never create separate networks per compose file — use `external: true` referencing the shared network in every compose file. Confidence: 0.75

# Typescript
- Write ingestion layer scripts in TypeScript (.ts) not plain JavaScript (.js). Confidence: 0.75

# Charting
- For dashboard: Use TradingView charting library exclusively (not lightweight-charts) for all chart components — price charts, indicators, and any other visualizations. Confidence: 0.75

# Workflow
- Before triggering a backfill, re-authenticate the mstock broker via Dashboard → Brokers → Test Connection to ensure a fresh JWT session token is stored in Redis. Confidence: 0.65

