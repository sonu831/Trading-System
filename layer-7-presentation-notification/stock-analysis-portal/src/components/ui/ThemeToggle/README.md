# Theme Toggle Component

A simple button component to switch between Light and Dark themes.

## Usage

```jsx
import { ThemeToggle } from '@/components/ui';

export default function Navbar() {
  return (
    <nav>
      <Logo />
      <ThemeToggle />
    </nav>
  );
}
```

## Features

- Automatically detects current theme from context
- Animated icon transition (Sun <-> Moon)
- Persists preference via `theme-provider`
