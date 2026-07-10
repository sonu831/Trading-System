# Layer 8 — Dashboard (Options Scalping Cockpit)

> **One job:** Present ALL trading data on one screen. `/scalp` cockpit + broker settings + strategy registry.
> **Tech:** Next.js 13 · React 18 · Tailwind · **Port:** 3000

## Pages

| Route | Content |
|-------|---------|
| `/scalp` | ⚡ Options Scalping Cockpit — SafetyBar, PriceChart, OptionChainGrid, StrikePreview |
| `/brokers` | 🔑 Provider Registry — add/edit/enable/disable brokers |
| `/brokers/[id]` | Broker detail — credentials, test connection |
| `/strategies` | 🎯 Strategy Registry — enable/disable/tune |
| `/risk` | 🛡️ Risk Configuration — limits, sizing, cutoffs |

## Architecture

```
Organism (never fetch) → useMarket hooks → MarketApi adapter → /api/v1/* (L7)
          ↓
    typed ports (shared/types.ts)
```

## Key Components

| Dir | Content |
|-----|---------|
| `src/components/atoms/` | Button, Card, Badge (Tailwind semantic tokens) |
| `src/components/molecules/` | Modal, Table, StatTile |
| `src/components/organisms/` | SafetyBar, PriceChart, OptionChainGrid, StrikePreviewCard |
| `src/components/templates/` | CockpitTemplate (3-col CSS grid) |
| `src/hooks/useMarket.ts` | Typed hooks: useIndexQuote, useCandles, useOptionChain |
| `src/api/index.ts` | Typed adapters: MarketApi, OptionsApi, ExecutionApi |
| `src/shared/types.ts` | Re-exports from root `shared/types.ts` |
| `src/store/slices/` | Redux: cockpit, broker, execution, regime, market |

## Adding a New Page

```tsx
// 1. Create pages/<name>/index.tsx
// 2. Import AppLayout from '@/components/layout'
// 3. Use typed hooks from '@/hooks/useMarket'
// 4. Add Navbar link in components/layout/Navbar
```

## Run

```bash
make layer8          # Local dev (next dev on :3000)
npm run dev          # Inside stock-analysis-portal/
```
