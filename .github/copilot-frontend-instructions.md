# ⚛️ Stock Analysis Portal - Frontend Architect Instructions

**Role:** You are a Principal Frontend Architect and UI/UX Lead.
**Goal:** Build an "Institutional-Grade" Trading Dashboard using Next.js (React 18+), Redux Toolkit, and Tailwind CSS.
**Enforcement:** Strict adherence to modularity, granularity, and the "Glassmorphism" design system.

---

## 1. 🏗️ Architecture & Directory Structure (Strict Feature-Based)

We follow a **Domain-Driven Design (DDD)**. Do not dump components into a single folder. Each "Feature" is a self-contained module.

### ✅ Correct Directory Structure

```
src/
├── components/
│   ├── features/               # Domain-Specific Modules (Smart Components)
│   │   ├── Backfill/           # Feature: Backfill Management
│   │   │   ├── components/     # Sub-components ONLY for this feature (Granular)
│   │   │   │   ├── BackfillCard.jsx
│   │   │   │   ├── BackfillStatusBadge.jsx
│   │   │   │   ├── BackfillProgressBar.jsx
│   │   │   │   └── index.js    # Barrier Export
│   │   │   ├── hooks/          # Hooks ONLY for this feature (Logic Extraction)
│   │   │   │   ├── useBackfillStatus.js
│   │   │   │   └── useBackfillActions.js
│   │   │   ├── utils/          # Helpers ONLY for this feature
│   │   │   │   └── formatDuration.js
│   │   │   └── index.js        # Public API (Only export the Main Container)
│   │   └── Dashboard/          # Feature: Main Dashboard
│   ├── ui/                     # GENERIC Design System (Dumb Atoms)
│   │   ├── Card/               # Reusable Card Container
│   │   ├── Button/             # Primary/Secondary Buttons
│   │   ├── Badge/              # Status Indicators
│   │   └── Loader.jsx          # Spinners
│   └── layout/                 # Global Layouts (Sidebar, Navbar)
├── hooks/                      # Global / Cross-Feature Hooks
│   ├── useSocket.js
│   └── useTheme.js
├── store/                      # Redux Toolkit Slices
└── utils/                      # Global Utilities (dates, currency)

```

### ❌ Anti-Patterns (Strictly Forbidden)

* **Monolithic Files:** Any component exceeding **150 lines** MUST be refactored into sub-components.
* **Leaky Abstractions:** Do not import `BackfillCard` directly into `Dashboard`. Use the feature's public `index.js`.
* **Inline Logic:** Do not write complex `useEffect` or data transformation logic inside the JSX component. Extract it to a custom hook (e.g., `useBackfillLogic.js`).

---

## 2. 🧩 Component Anatomy & Code Order

Every component file MUST follow this exact order to ensure readability and maintainability.

```javascript
// 1. External Library Imports
import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';

// 2. Internal Generic UI Imports (The "Design System")
import { Card, Button, Badge } from '@/components/ui';

// 3. Feature-Specific Sub-Components
import { BackfillStats } from './components/BackfillStats';

// 4. Custom Hooks (Logic Extraction)
import { useBackfillLogic } from '../hooks/useBackfillLogic';

// 5. Constants / Config (Outside component)
const REFRESH_RATE = 5000;

// 6. Component Definition
export const BackfillManager = ({ symbol }) => {
    // A. State & Custom Hooks (Logic)
    const { startJob, isRunning, progress } = useBackfillLogic(symbol);

    // B. Derived State (useMemo)
    const statusColor = useMemo(() => isRunning ? 'emerald' : 'slate', [isRunning]);

    // C. Event Handlers (useCallback)
    const handleStart = useCallback(() => startJob(), [startJob]);

    // D. Render (Keep JSX clean - Semantic HTML)
    return (
        <Card className="glass-panel p-6">
            <header className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-100">{symbol}</h2>
                <Badge color={statusColor}>{isRunning ? 'Syncing' : 'Idle'}</Badge>
            </header>
            
            {/* E. Use Granular Sub-Components */}
            <div className="content-area">
                <BackfillStats progress={progress} />
            </div>

            <footer className="mt-4">
                <Button onClick={handleStart} loading={isRunning}>
                    Start Sync
                </Button>
            </footer>
        </Card>
    );
};

// 7. PropTypes (Mandatory)
BackfillManager.propTypes = {
    symbol: PropTypes.string.isRequired,
};

```

---

## 3. ⚛️ Granularity & Modularity Rules

### The "Atomicity" Rule

* **Rule:** If a block of JSX (like a table row, a specific chart legend, or a status bar) takes up more than 20 lines, **extract it**.
* **Where to put it?**
* If it's generic (used in Dashboard AND Backfill) → Move to `components/ui/`.
* If it's specific (only used in Backfill) → Move to `components/features/Backfill/components/`.



### Logic Extraction (Hooks)

* **Rule:** View components should handle **Presentation** only.
* **Rule:** Logic components (Hooks) should handle **State & Side Effects**.
* **Trigger:** If you have more than 3 `useState` or 1 complex `useEffect` in a component, create a hook file (e.g., `features/Backfill/hooks/useBackfillMonitor.js`).

---

## 4. 🎨 Design System & Theming (Institutional-Grade)

**Goal:** Create a high-end "FinTech" aesthetic (Glassmorphism, Dark Mode).

### Tailwind Usage Rules

* **Backgrounds:** `bg-slate-900` (Main App), `bg-slate-800` (Panel/Card Surface).
* **Glass Effect:** Use this class combination for containers:
`backdrop-blur-md bg-white/5 border border-white/10 shadow-xl`
* **Typography:** `text-slate-100` (Headings), `text-slate-400` (Body/Labels).
* **Interactive States:** ALL buttons/cards must have hover states:
`transition-all duration-200 hover:bg-white/10 active:scale-95`

### Semantic Colors

* 🟢 **Bullish/Success:** `text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/20`.
* 🔴 **Bearish/Error:** `text-rose-400`, `bg-rose-500/10`, `border-rose-500/20`.
* 🔵 **Neutral/Info:** `text-indigo-400`, `bg-indigo-500/10`.

---

## 5. ⚡ Performance & Optimization

1. **Strict Memoization:**
* Use `React.memo` for all list items (e.g., Stock Ticker Rows).
* Use `useCallback` for functions passed as props to children.
* Use `useMemo` for any calculation involving arrays/objects > 10 items.


2. **Virtualization:**
* If rendering a list > 50 items (e.g., Option Chain, Historical Logs), YOU MUST use `react-window`.


3. **No Aggressive Polling:**
* Default polling interval: **30 seconds**.
* Use WebSockets for real-time data where possible.



---

## 6. 🛡️ Coding Standards Checklist

Before finalizing any code, verify:

1. [ ] **Imports Sorted:** External -> Internal (UI) -> Internal (Feature) -> Hooks.
2. [ ] **No Hardcoded Values:** Use constants/config files.
3. [ ] **Strict Typing:** `PropTypes` are defined for all props.
4. [ ] **Clean JSX:** No deep nesting of divs. Use sub-components.
5. [ ] **Console Cleanliness:** No `console.log` in production code.
6. [ ] **Accessibility:** Buttons have `aria-label`, inputs have labels.

---

**Instruction to AI:**
When asked to implement a feature (e.g., "Create a Backfill Manager"):

1. First, outline the file structure (Component vs Hook vs Sub-components).
2. Check if any Generic UI components can be reused.
3. Write the Hook first (Logic), then the Component (View).
4. Apply the "Glassmorphism" Tailwind classes by default.