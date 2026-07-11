# Auto-Trading Design System

A design system for **Stock Analysis By Gurus** — an Indian-markets (NSE) auto-trading and
options-scalping platform. Tagline used in the product itself: *"India's First Complex to Simple
AI Driven Stock Analysis Application."*

Built by reading the real product source, not a screenshot: `stock-analysis-portal/` (a Next.js +
Tailwind app), which is Layer 8 ("Presentation & Notification") of a larger multi-layer trading
system. Nothing here is invented branding — every color, spacing value, and component is lifted
from that codebase.

## Sources

- **Attached local codebase**: `stock-analysis-portal/` — Next.js 13 / React 18 / Tailwind dashboard. Read in full: styles, tokens, `components/ui`, `components/trading`, `components/organisms`, `components/molecules`, `components/features/Dashboard`, layout, pages.
- **GitHub repo**: [sonu831/Trading-System](https://github.com/sonu831/Trading-System) — the full trading system this dashboard is Layer 8 of (ingestion → processing → signal → execution → presentation). The same portal lives inside it at `layer-8-presentation-notification/stock-analysis-portal/`. Explore this repo further (`ARCHITECTURE.md`, `docs/OPTIONS_SCALPING_RULES.md`, `docs/BROKER_LOGIN_FLOWS.md`) for domain rules that should inform any new screens — options-scalping semantics, risk envelopes, and broker-credential flows are all specified there in more depth than this design system captures.

## What this product actually is

Reading the pages (`/scalp`, `/positions` aka trading, `/brokers`, `/risk`, `/strategies`,
`/backfill`, `/` dashboard) plus `README.md` and the org's own rule comments in source
(`SafetyBar.tsx`, `KillSwitchButton.tsx`), the product is an **options-scalping cockpit** for
NIFTY/BANKNIFTY, with:

- A live market dashboard (sentiment, advance/decline, watchlist, AI signals).
- A scalping cockpit: sticky safety bar (spot + trade mode + kill switch), price chart, live
  option chain, "Engine Intent" strike preview.
- A positions/risk view: open positions, daily-loss circuit breaker, per-trade risk.
- Broker credential management (multiple brokers, connect/disconnect, paper/shadow/live modes).
- Strategy registry (enable/disable/tune running strategies) and a Backfill tool for pulling
  historical candle data into the database.
- The rest of the system (ingestion, processing, signal, execution, AI service — layers 1–10 of
  the GitHub repo) never renders UI; it feeds this Layer-8 dashboard.

This is a **single-user-operated trading terminal**, not a multi-tenant SaaS with marketing pages
— there's no landing/pricing/signup surface in the source, only the operating dashboard.

## Index

- `styles.css` — root stylesheet, `@import`s everything below. Link this one file.
- `tokens/` — `colors.css` (light + `[data-theme="dark"]`), `typography.css`, `spacing.css` (spacing/radius/shadow/motion).
- `components/` — reusable primitives, grouped:
  - `core/` — Button, Badge, Card, Input
  - `feedback/` — StaleBadge, TradeModeBadge, KillSwitchButton
  - `data/` — StatTile, RiskMeter, Table
  - `overlay/` — Modal
  - `trading/` — OptionChainGrid, SafetyBar, PositionsTable, DailyRiskCard
- `guidelines/` — foundation specimen cards (colors, type, spacing, radius, elevation, motion, iconography, wordmark).
- `ui_kits/trading-cockpit/` — mobile-first click-through recreation: Dashboard, Scalp, Positional (option-selling), Backfill, Brokers screens behind a bottom tab bar.
- `assets/` — empty. **No logo file exists anywhere in the source** — see Iconography/Brand below.
- `SKILL.md` — Claude Code / Agent Skill wrapper for this folder.

## Components

Badge, Button, Card (+ CardHeader/CardBody/CardFooter), Input, StaleBadge, TradeModeBadge,
KillSwitchButton, StatTile, RiskMeter, Table (+ Header/Body/Row/HeaderCell/Cell), Modal (+
Header/Body/Footer), OptionChainGrid, SafetyBar, PositionsTable, DailyRiskCard.

**Intentional additions**: none of the above are invented — every one has a direct counterpart in
`stock-analysis-portal/src/components/`. `Table` generalizes the source's `<Table>` primitives
(used by `DataTable`); `DailyRiskCard`/`RiskMeter`/`StatTile`/`StaleBadge`/`TradeModeBadge`/
`KillSwitchButton` are copied near-verbatim from `src/components/trading/`, which is the newer,
cleaner layer of the codebase (semantic tokens + lucide icons) — the older `src/components/
features/Dashboard/*` and `ScoreGauge.tsx` still hardcode Tailwind gray/blue/green swatches
instead of the semantic tokens. This design system standardizes on the newer `trading/` idiom;
flagged here so you know the inconsistency exists in the real app.

## Content fundamentals

- **Voice**: direct, operator-facing, no marketing fluff. Labels are short nouns ("Day P&L", "Max
  Concurrent", "Entry Cutoff"), not sentences. Second person is rare — most copy describes system
  state in third person ("Engine unreachable", "Trading was halted").
- **Case**: sentence case for labels and body copy; UPPERCASE only for hard state flags —
  `PAPER`/`SHADOW`/`LIVE`, `HALTED`, `KILL`, `NO STOP`, `STALE`. Uppercase is reserved for things
  that must interrupt a fast-scanning eye during scalping.
  <br>Example from source: <code>"HALTED — Resume"</code>, <code>"KILL"</code>, <code>"ENGINE
  OFFLINE"</code>.
- **Numbers over adjectives**: state is quantified wherever possible — "70% · Approaching limit"
  rather than "Getting risky". Unknown values render as an em-dash (`—`), never a confident `0`
  or blank — this is an explicit rule in source code comments (`RiskMeter.tsx`,
  `PositionsTable.tsx`: *"Unknown values are an em-dash, never a confident 0."*).
- **Color is never the only cue.** Every source component that uses color for meaning (P&L,
  stop-loss presence, risk severity, trade mode) also states the meaning in words next to it —
  literally commented in source as a design rule ("Contract (dataviz): … colour is a supplement,
  never the only cue").
- **Confirmations scale with danger.** Halting trading needs one click + one confirm. *Resuming*
  after a circuit-breaker trip requires typing a phrase — resuming is the genuinely dangerous
  direction, and copy treats it that way ("Confirm the day's loss limit and strategy behaviour
  before you do this.").
- **A little personality, used sparingly**: the footer carries an actual human signature — *"This
  Application is designed by Yogendra and Utkarsh. Unauthorized reproduction or copying of these
  unique ideas will lead to legal action."* — and the nav uses a handful of literal emoji as
  route glyphs (📈 Trading, 📥 Backfill, ⚡ Scalp, 🔑 Brokers, 🐝 Swarm Monitor) and inside the
  older dashboard widgets (🐂/🐻/⚖️ sentiment, 🎯 AI picks, 🤖 AI analysis). Emoji are used as
  quick-scan glyphs, not decoration — don't scatter them elsewhere.
- **Indian-market conventions**: currency is always ₹ with `en-IN` grouping (`₹12,45,000` style
  via `toLocaleString('en-IN')`); times are IST; index names are NIFTY/BANKNIFTY.

## Visual foundations

- **Palette**: Slate neutrals (background/surface/border/text) + Blue primary, Emerald secondary,
  Violet accent, plus Success(emerald)/Error(red)/Warning(amber)/Info(blue) semantic colors — all
  as RGB-triplet CSS variables in source so Tailwind can apply them at any alpha
  (`rgb(var(--color-primary) / <alpha-value>)`). Dark mode is a **separate token set** (not just
  darkened light values) — see `colors-theme-comparison` card.
- **Type**: no custom webfont. Tailwind ships no `fontFamily` override, so the product
  deliberately runs on the OS system-UI stack — fastest paint, native digit rendering, no FOIT.
  Mono (`ui-monospace`/`SFMono`) is reserved for prices, contract symbols, and countdown clocks —
  always with `tabular-nums` in tables.
  Weight range 400–800; extrabold (800) only for the nav wordmark/hero numbers.
- **Spacing/radius**: plain Tailwind 4px scale. Cards/panels are `rounded-xl` (12px); buttons/
  inputs `rounded-lg` (8px); pills/badges `rounded-xl`/`rounded-full`. Borders are always 1px
  solid `--color-border`, never colored accents on one side only.
  **Note per style guidance**: this system deliberately avoids the "card with a colored left
  border" trope even though it isn't explicitly forbidden in source — source cards use a plain
  all-around border instead.
- **Cards**: `bg-surface` + `border-border` + `rounded-xl`, no shadow at rest; `shadow-lg` appears
  on the sticky SafetyBar and on hover-lift interactive cards (`hover:-translate-y-1
  hover:shadow-lg`). A `glass` variant exists (`bg-surface/70` + `backdrop-blur-md` +
  translucent white border) but is rare in source — reserved for overlays, not the default.
- **Backgrounds**: flat solid `--color-background` everywhere. No photography, no illustration,
  no repeating texture/pattern, no full-bleed imagery anywhere in the source. The only gradients
  are functional: primary→accent on the CTA button/wordmark, and severity gradients on the
  advance/decline meter fill (`from-success/40 to-success`). Backgrounds are never gradients.
- **Animation**: brief and utilitarian — 150/200/300ms, standard ease (`cubic-bezier(0.4,0,0.2,1)`
  via Tailwind's default transition timing). No bounce/spring anywhere. Modals fade + scale
  (0.95→1) over 300ms. A `LIVE` trade-mode badge and a `STALE` data dot both use a slow pulse
  (`animate-pulse`) to demand attention — pulsing is reserved for things that are actually urgent.
- **Hover states**: buttons lift `-translate-y-0.5` + gain a colored glow shadow; cards lift
  `-translate-y-1` + border turns primary; ghost buttons/links just brighten text color. No
  opacity-only hover states on primary actions.
- **Press/active states**: not explicit in source CSS (native browser `:active` only) —
  consumers should add a subtle scale-down (0.98) or brightness dip if a press state is needed;
  none is currently defined, so don't invent an elaborate one.
- **Borders**: always 1px, always `--color-border`, always solid — no dashed/dotted borders
  anywhere in source.
- **Shadows**: standard Tailwind `shadow-md`/`shadow-lg`/`shadow-2xl` (soft, neutral-gray,
  no colored glows except the intentional button hover glows noted above).
- **Transparency/blur**: used narrowly — modal backdrop (`bg-black/60 backdrop-blur-sm`), the
  rare `glass` Card variant, and alpha-tinted semantic backgrounds (`bg-success/20` etc. for
  badges/meters). Never blurred over content the user needs to read continuously.
- **Imagery**: none. No photography, no illustration style defined anywhere in the source — this
  is a data-and-numbers product, not an imagery-led one.

## Iconography

- **System**: [lucide-react](https://lucide.dev) (MIT) — confirmed via direct imports in source
  (`KillSwitchButton.tsx`: `XOctagon, Play`; `TradeModeBadge.tsx`: `FlaskConical, Eye, Zap,
  HelpCircle`; `PositionsTable.tsx`: `ShieldCheck, ShieldAlert, TrendingUp, TrendingDown`;
  `DailyRiskCard.tsx`: `ShieldAlert`). Outline style, 2px stroke, sized 13–15px inline with text.
  This design system loads the vanilla `lucide` UMD build from CDN (`unpkg.com/lucide@…`) since
  there is no React-specific bundle step here — same icon set, `data-lucide="name"` +
  `lucide.createIcons()` instead of `<Icon />`.
- **Emoji** are used deliberately as route/section glyphs in the nav and a few dashboard widgets
  (see Content fundamentals) — not as a general icon substitute.
- **No PNG icon assets, no custom icon font, no SVG sprite** exist in the source repo.
- **No logo file exists anywhere in the source** (`stock-analysis-portal/` has no `public/`
  directory with a logo, and none was found in the GitHub mirror either). Per instructions, no
  logo has been invented for this design system. Wherever a mark would go, render the brand name
  "Stock Analysis By Gurus" as a primary→accent gradient wordmark (see `guidelines/wordmark`
  card) — this is exactly what the product's own `Navbar.tsx` does today.

## Known inconsistency in source (flagged, not fixed)

Two visual eras coexist in the real codebase: the newer `src/components/trading/*` +
`src/components/organisms/*` layer (semantic CSS-variable tokens, lucide icons, the patterns this
design system standardizes on) and an older `src/components/features/Dashboard/*` +
`ScoreGauge.tsx` layer that hardcodes raw Tailwind grays/blues/greens (`bg-gray-800`,
`text-blue-400`, etc.) instead of the theme tokens — meaning those older widgets do not actually
respond to the light/dark toggle. This design system follows the newer, token-driven layer
throughout; if you're extending the real app rather than prototyping, budget time to migrate the
older widgets rather than copying their raw Tailwind classes.

## Caveats & how to help me improve this

- **No logo/brand mark was provided anywhere in the sources.** If one exists, attach it and I'll
  wire it in everywhere the wordmark currently stands in.
- **No Figma file was attached** — everything here is inferred from the Next.js/Tailwind source
  only. If a Figma design system exists for this product, attach it so I can true-up spacing,
  color, and component details that only live in a design tool.
- The `ui_kits/trading-cockpit/` UI kit is a **from-scratch mobile layout** (bottom-tab, single
  scrolling page per tab) built to satisfy "mobile-friendly, HFT-dense, one/two pages" — the
  source app itself is desktop-first (`CockpitTemplate`'s 3-column CSS grid) with no mobile
  layout defined, so this is new interaction design, not a recreation. Tell me if you'd rather I
  match the desktop grid more literally, or keep pushing the mobile-first direction further.
  Positional/option-selling Greeks (theta/delta/IV) shown there are illustrative — the real
  `shared/types.ts` position shape may carry different/additional fields worth wiring up exactly.
- Broker connections are modeled as **per-user** (see the account strip on the Brokers screen) per
  your note — confirm whether real multi-user auth exists yet in the backend, since the source
  `/brokers` page has no visible user/session concept today.
