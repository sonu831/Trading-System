# AppLayout Component

The main application layout wrapper.

## Usage

```jsx
import { AppLayout } from '@/components/layout';

export default function Dashboard() {
  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  );
}
```

## Props

| Prop           | Type     | Default | Description             |
| -------------- | -------- | ------- | ----------------------- |
| `children`     | node     | -       | Page content            |
| `viewMode`     | string   | -       | Prop drilled for Navbar |
| `setViewMode`  | function | -       | Prop drilled for Navbar |
| `systemStatus` | string   | -       | Prop drilled for Navbar |
