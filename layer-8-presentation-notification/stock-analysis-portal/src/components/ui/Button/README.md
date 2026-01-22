# Button Component

## Overview

A flexible, reusable button component with multiple variants, sizes, and states.

## Usage

```jsx
import Button from '@/components/ui/Button';

// Primary button
<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>

// Loading state
<Button variant="primary" loading>
  Processing...
</Button>

// Different sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

## Props

| Prop        | Type                                                           | Default     | Description                |
| ----------- | -------------------------------------------------------------- | ----------- | -------------------------- |
| `variant`   | `'primary' \| 'secondary' \| 'outline' \| 'danger' \| 'ghost'` | `'primary'` | Visual style variant       |
| `size`      | `'sm' \| 'md' \| 'lg'`                                         | `'md'`      | Button size                |
| `disabled`  | `boolean`                                                      | `false`     | Disabled state             |
| `loading`   | `boolean`                                                      | `false`     | Loading state with spinner |
| `onClick`   | `function`                                                     | -           | Click event handler        |
| `type`      | `'button' \| 'submit' \| 'reset'`                              | `'button'`  | Button type attribute      |
| `className` | `string`                                                       | `''`        | Additional CSS classes     |
| `children`  | `node`                                                         | -           | Button content (required)  |

## Variants

### Primary

Main action button with gradient background.

```jsx
<Button variant="primary">Primary Action</Button>
```

### Secondary

Secondary actions with subtle styling.

```jsx
<Button variant="secondary">Secondary Action</Button>
```

### Outline

Outlined button for tertiary actions.

```jsx
<Button variant="outline">Outlined</Button>
```

### Danger

Destructive actions (delete, remove, etc.).

```jsx
<Button variant="danger">Delete</Button>
```

### Ghost

Minimal styling for subtle actions.

```jsx
<Button variant="ghost">Cancel</Button>
```

## Examples

### Form Submit Button

```jsx
<Button type="submit" variant="primary" loading={isSubmitting} disabled={!isValid}>
  Submit Form
</Button>
```

### Icon Button

```jsx
<Button variant="ghost" size="sm">
  <TrashIcon /> Delete
</Button>
```

## Accessibility

- Automatically disabled when `loading` or `disabled` is true
- Supports keyboard navigation
- Proper `type` attribute for forms
