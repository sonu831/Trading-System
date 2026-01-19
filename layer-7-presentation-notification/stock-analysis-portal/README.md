# Stock Analysis Portal

The frontend dashboard for the Trading System, built with Next.js.

This project follows strict architectural guidelines for scalability and maintainability.

## 🏗️ Architectural Standards

We follow a strict **Page (Container) -> Feature (View)** separation.

### 1. Core Architecture

#### The Page (Container)

- **Location**: `src/pages/`
- **Responsibility**:
  - **Data & State**: Holds all business logic and state management.
  - **Hooks**: MUST use custom hooks (e.g., `useDashboard`) to encapsulate logic.
  - **Pure Container**: Does not contain styling or complex JSX. Mostly wraps Feature components.
- **Example**: `src/pages/index.js` consumes `hooks/useDashboard.js` and renders `components/features/Dashboard/index.jsx`.

#### The Feature (View)

- **Location**: `src/components/features/`
- **Responsibility**:
  - **Pure Presentation**: Receives all data and handlers via props.
  - **Composition**: Composes generic UI components and sub-components.
  - **Stateless**: No API calls or business logic. Only strictly UI state (e.g., toggle dropdown).
- **Example**: `src/components/features/Dashboard/index.jsx`.

#### The UI Library

- **Location**: `src/components/ui/`
- **Responsibility**: Generic, atomic components (Button, Card, Badge) that are reusable across features.

### 2. File Structure

```text
src/
├── pages/
│   ├── index.js          # Page Container
│   └── ...
│
├── hooks/
│   ├── useDashboard.js   # Single source of Logic/State for the Page
│   └── ...
│
├── components/
│   ├── ui/               # Generic Atoms
│   │   ├── Button/
│   │   │   ├── Button.jsx
│   │   │   └── index.js
│   │   └── ...
│   │
│   ├── features/         # Feature Views
│   │   ├── Dashboard/
│   │   │   ├── index.jsx        # Main View
│   │   │   ├── components/      # Sub-components
│   │   │   │   ├── NiftyGrid.jsx
│   │   │   │   └── ...
│   │   └── ...
```

### 3. Coding Standards

#### Import Rules

- **ALWAYS use relative paths** for internal imports.
  - ✅ `import Button from '../../ui/Button';`
  - ❌ `import Button from '@/components/ui/Button';`

#### Naming Conventions

- **Components**: PascalCase (e.g., `MarketOverview.jsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useMarketData.js`)
- **Extensions**:
  - Components/Views: `.jsx`
  - Hooks/Logic/Utils: `.js`

#### Styling

- **Framework**: Tailwind CSS.
- **Pattern**: Utility classes. Avoid inline styles.
- **Responsive**: Mobile-first (`className="p-4 md:p-6"`).

#### State Management

- **Page Level**: All major state lives in the Page's custom hook.
- **Prop Drilling**: Pass data down to Feature View.

## 🚀 Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev:local
   ```
