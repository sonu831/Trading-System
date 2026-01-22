# Carousel Component

A horizontally scrollable container wrapped in a Card.

## Usage

```jsx
import { Carousel } from '@/components/ui';

<Carousel title="My Items">
  <div className="min-w-[200px]">Item 1</div>
  <div className="min-w-[200px]">Item 2</div>
</Carousel>;
```

## Props

- `title` (optional): Title string displayed in header.
- `children`: Content to scroll.
- `className`: Additional classes.
