# Stock Analysis Portal - Frontend Architect Instructions

**Role:** You are a Principal Frontend Architect and UI/UX Lead.
**Goal:** Build an "Institutional-Grade" Trading Dashboard using Next.js (React 18+), Redux Toolkit, and Tailwind CSS.
**Enforcement:** Strict adherence to modularity, granularity, and the "Glassmorphism" design system.

---

## 1. Architecture & Directory Structure (Strict Feature-Based)

We follow a **Domain-Driven Design (DDD)**. Each "Feature" is a self-contained module with **domain-meaningful subfolders** — never a generic `components/` subfolder.

### Correct Directory Structure

```
src/
├── components/
│   ├── Analysis/              # Feature: Stock Analysis
│   │   ├── Chart/             # Domain: Chart rendering
│   │   │   ├── StockChart.jsx
│   │   │   └── IndicatorOverlayToggle.jsx
│   │   ├── Indicators/        # Domain: Technical indicators
│   │   │   ├── IndicatorPanel.jsx
│   │   │   └── CandlePatternBadges.jsx
│   │   ├── Timeframe/         # Domain: Multi-timeframe analysis
│   │   │   ├── TimeframeSelector.jsx
│   │   │   ├── MultiTimeframeSummary.jsx
│   │   │   └── EnhancedMultiTFSummary.jsx
│   │   ├── Predictions/       # Domain: AI & options analysis
│   │   │   ├── AIPredictionPanel.jsx
│   │   │   ├── BacktestPanel.jsx
│   │   │   └── PCRPanel.jsx
│   │   └── index.js           # Barrel Export (all sub-components)
│   │
│   ├── Dashboard/             # Feature: Main Dashboard
│   │   ├── Market/            # Domain: Market data displays
│   │   │   ├── MarketOverview.jsx
│   │   │   └── TopMovers.jsx
│   │   ├── Grid/              # Domain: Tabbed content
│   │   │   ├── NiftyGrid.jsx
│   │   │   └── SignalsFeed.jsx
│   │   ├── Widgets/           # Domain: Supporting widgets
│   │   │   ├── TopPicksWidget.jsx
│   │   │   └── DashboardSkeleton.jsx
│   │   ├── index.jsx          # Main Component (DashboardView)
│   │   └── index.js           # Barrel Export
│   │
│   ├── Backfill/              # Feature: Backfill Management
│   │   ├── Actions/           # Domain: User actions
│   │   │   ├── BackfillModal.jsx
│   │   │   ├── BackfillForm.jsx
│   │   │   └── BackfillPanel.jsx
│   │   ├── Status/            # Domain: Monitoring & status
│   │   │   ├── BackfillProgress.jsx
│   │   │   ├── BackfillCoverage.jsx
│   │   │   └── SwarmNotification.jsx
│   │   └── index.js           # Barrel Export
│   │
│   ├── Notifications/         # Feature: Notification System
│   │   ├── NotificationBell.jsx
│   │   ├── NotificationFeed.jsx
│   │   ├── NotificationItem.jsx
│   │   ├── NotificationToast.jsx
│   │   └── index.js           # Barrel Export
│   │
│   ├── common/                # Shared Components (EmptyState, PageHeader)
│   │   └── index.js           # Barrel Export
│   ├── ui/                    # Design System Atoms (Card, Button, Badge)
│   │   └── index.js           # Barrel Export
│   └── layout/                # App Layout (Navbar, Footer, AppLayout)
│       └── index.js           # Barrel Export
│
├── hooks/                     # Custom Hooks (Feature-Based)
│   ├── analysis/              # Analysis hooks
│   │   ├── useAnalysis.js
│   │   └── useStockAnalysis.js
│   ├── backfill/              # Backfill hooks
│   │   ├── useBackfillLogic.js
│   │   └── useBackfillManager.js
│   ├── dashboard/             # Dashboard hooks
│   │   └── useDashboard.js
│   ├── common/                # Shared hooks
│   │   ├── useSocket.js
│   │   ├── useDbSync.js
│   │   └── useMounted.js
│   └── index.js               # Barrel Export (re-exports all)
│
├── store/                     # Redux Toolkit Slices
├── context/                   # React Context (NotificationContext)
├── pages/                     # Next.js Pages (routing)
└── utils/                     # Global Utilities (dates, currency)
```

### Anti-Patterns (Strictly Forbidden)

* **Generic `components/` subfolder:** NEVER create a `components/` folder inside a feature. Use domain-meaningful names (e.g., `Chart/`, `Market/`, `Status/`).
* **Leaky Abstractions:** Do not import `StockChart` directly from `Analysis/Chart/StockChart`. Use the feature's public barrel `index.js`: `import { StockChart } from '@/components/Analysis'`.
* **Inline Logic:** Do not write complex `useEffect` or data transformation logic inside JSX. Extract it to a custom hook.
* **Orphaned Files:** Do not leave standalone `.jsx` files in `components/` root. Every component belongs to a feature folder.
* **Stale Barrel Exports:** When moving/adding files, always update the feature's `index.js` barrel.

### Subfolder Clustering Rules

When a feature folder has **more than 4 files**, cluster them into domain subfolders:

| Feature | Cluster By | Examples |
|---------|-----------|----------|
| Analysis | Functionality | `Chart/`, `Indicators/`, `Timeframe/`, `Predictions/` |
| Dashboard | UI Region | `Market/`, `Grid/`, `Widgets/` |
| Backfill | User Intent | `Actions/`, `Status/` |
| Notifications | Flat (< 5 files) | Files directly in folder |

---

## 2. Component Anatomy & Code Order

Every component file MUST follow this exact order:

```javascript
// 1. External Library Imports
import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

// 2. Internal Generic UI Imports (The "Design System")
import { Card, Button, Badge } from '@/components/ui';

// 3. Feature-Specific Sub-Components (from domain subfolders)
import { BackfillStats } from './Status/BackfillStats';

// 4. Custom Hooks (Logic Extraction)
import { useBackfillLogic } from '@/hooks/backfill/useBackfillLogic';

// 5. Constants / Config
const REFRESH_RATE = 5000;

// 6. Component Definition
export const BackfillManager = ({ symbol }) => {
    // A. State & Custom Hooks
    const { startJob, isRunning, progress } = useBackfillLogic(symbol);

    // B. Derived State (useMemo)
    const statusColor = useMemo(() => isRunning ? 'emerald' : 'slate', [isRunning]);

    // C. Event Handlers (useCallback)
    const handleStart = useCallback(() => startJob(), [startJob]);

    // D. Render (Clean JSX)
    return (
        <Card className="glass-panel p-6">
            <BackfillStats progress={progress} />
            <Button onClick={handleStart} loading={isRunning}>Start Sync</Button>
        </Card>
    );
};

// 7. PropTypes (Mandatory)
BackfillManager.propTypes = {
    symbol: PropTypes.string.isRequired,
};
```

---

## 3. Granularity & Modularity Rules

### The "Atomicity" Rule

* **Rule:** If a block of JSX takes up more than 20 lines, **extract it** into its own file.
* **Where to put it?**
  * If generic (used across features) → `components/ui/`
  * If feature-specific → Into the appropriate domain subfolder within the feature

### Logic Extraction (Hooks)

* View components handle **Presentation** only.
* Hooks handle **State & Side Effects**.
* **Trigger:** More than 3 `useState` or 1 complex `useEffect` → create a hook (e.g., `hooks/backfill/useBackfillMonitor.js`).

---

## 4. Design System & Theming (Institutional-Grade)

**Goal:** High-end "FinTech" aesthetic (Glassmorphism, Dark Mode).

### Tailwind Usage Rules

* **Backgrounds:** `bg-slate-900` (Main App), `bg-slate-800` (Panel/Card Surface).
* **Glass Effect:** `backdrop-blur-md bg-white/5 border border-white/10 shadow-xl`
* **Typography:** `text-slate-100` (Headings), `text-slate-400` (Body/Labels).
* **Interactive States:** ALL buttons/cards must have hover states:
  `transition-all duration-200 hover:bg-white/10 active:scale-95`

### Semantic Colors

* Bullish/Success: `text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/20`.
* Bearish/Error: `text-rose-400`, `bg-rose-500/10`, `border-rose-500/20`.
* Neutral/Info: `text-indigo-400`, `bg-indigo-500/10`.

---

## 5. Performance & Optimization

1. **Strict Memoization:**
   * `React.memo` for all list items (Stock Ticker Rows).
   * `useCallback` for functions passed as props to children.
   * `useMemo` for any calculation involving arrays/objects > 10 items.

2. **Virtualization:**
   * Lists > 50 items MUST use `react-window`.

3. **No Aggressive Polling:**
   * Default polling interval: **30 seconds**.
   * Use WebSockets for real-time data where possible.

---

## 6. Coding Standards Checklist

Before finalizing any code, verify:

1. [ ] **Imports Sorted:** External -> Internal (UI) -> Internal (Feature) -> Hooks.
2. [ ] **No Hardcoded Values:** Use constants/config files.
3. [ ] **Strict Typing:** `PropTypes` are defined for all props.
4. [ ] **Clean JSX:** No deep nesting of divs. Use sub-components.
5. [ ] **Console Cleanliness:** No `console.log` in production code.
6. [ ] **Accessibility:** Buttons have `aria-label`, inputs have labels.
7. [ ] **Barrel Exports Updated:** Feature `index.js` reflects all public components.

---

**Instruction to AI:**
When asked to implement a feature:

1. First, outline the file structure (Component vs Hook vs Domain Subfolders).
2. Check if any Generic UI components can be reused.
3. Write the Hook first (Logic), then the Component (View).
4. If the feature has > 4 files, cluster into domain subfolders.
5. Always update the barrel `index.js` after adding files.

---

## 7. Notification Services Standards (Layer 8)

**Goal:** Treat Email and Telegram as "Presentation Layers". They must deliver the same "Institutional-Grade" info-density and aesthetic as the Dashboard.

### Architecture for Notification Services

```
src/
├── config/                 # Centralized Env Vars
├── core/                   # Infrastructure (Logger, Metrics)
├── services/               # Transport Logic (Nodemailer, Telegraf)
├── presentation/           # THE PRESENTATION LAYER
│   ├── templates/          # HTML generators
│   │   ├── colors.js       # Shared color tokens (match Dashboard)
│   │   ├── BaseLayout.js   # Glassmorphism HTML wrapper
│   │   └── NotificationEmail.js
│   └── formatters/         # Data -> Text/Markdown converters
├── index.js                # Orchestrator
```

### Presentation-First Rules

1. **Rich Content:** Never send plain text if HTML/Markdown is possible.
2. **Consistent Branding:** Use the same Color Palette as the Dashboard.
3. **Inline CSS:** For emails, use inline styles that mimic Glassmorphism.
4. **Interactive-Feel:** Emails should look like "Mini Dashboards".

### Key Principles

1. **Componentize:** Even in Node.js, think in components. `renderHeader()`, `renderStatusBadge()`.
2. **Shared Aesthetics:** If the dashboard changes to "Blue", update the notification `colors.js` to match.
3. **Observability:** Monitor "Sent", "Failed", and "Open Rates" (if possible).
