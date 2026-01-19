# Card Component

## Overview

A flexible container component with optional header, body, and footer sections.

## Usage

```jsx
import Card from '@/components/ui/Card';

// Basic card
<Card>
  <p>Content goes here</p>
</Card>

// Card with header, body, and footer
<Card variant="glass">
  <Card.Header>Card Title</Card.Header>
  <Card.Body>
    <p>Main content</p>
  </Card.Body>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>

// Hoverable card
<Card hoverable onClick={handleClick}>
  <p>Click me!</p>
</Card>
```

## Props

### Card

| Prop        | Type                                 | Default     | Description             |
| ----------- | ------------------------------------ | ----------- | ----------------------- |
| `variant`   | `'default' \| 'glass' \| 'outlined'` | `'default'` | Visual style variant    |
| `padding`   | `'none' \| 'sm' \| 'md' \| 'lg'`     | `'md'`      | Internal padding        |
| `hoverable` | `boolean`                            | `false`     | Enable hover effect     |
| `className` | `string`                             | `''`        | Additional CSS classes  |
| `children`  | `node`                               | -           | Card content (required) |

### Card.Header, Card.Body, Card.Footer

| Prop        | Type     | Default | Description            |
| ----------- | -------- | ------- | ---------------------- |
| `className` | `string` | `''`    | Additional CSS classes |
| `children`  | `node`   | -       | Content (required)     |

## Variants

### Default

Standard card with solid background.

```jsx
<Card variant="default">Content</Card>
```

### Glass

Glassmorphism effect with blur.

```jsx
<Card variant="glass">Content</Card>
```

### Outlined

Transparent background with border.

```jsx
<Card variant="outlined">Content</Card>
```

## Examples

### Dashboard Stats Card

```jsx
<Card variant="glass" padding="lg">
  <Card.Header>Total Revenue</Card.Header>
  <Card.Body>
    <h2>$124,500</h2>
    <p>+12% from last month</p>
  </Card.Body>
</Card>
```

### Interactive Card

```jsx
<Card hoverable onClick={() => navigate('/details')}>
  <Card.Header>Stock: RELIANCE</Card.Header>
  <Card.Body>
    <p>Price: ₹2,750.05</p>
  </Card.Body>
  <Card.Footer>
    <Badge variant="success">+2.5%</Badge>
  </Card.Footer>
</Card>
```

### List Container

```jsx
<Card padding="none">
  {items.map((item) => (
    <div key={item.id} className="list-item">
      {item.name}
    </div>
  ))}
</Card>
```
