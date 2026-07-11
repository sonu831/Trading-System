Primary clickable action — use for form submits, nav CTAs, and dialog confirms.

```jsx
<Button variant="primary" size="md" onClick={handleBuy}>
  Place order
</Button>
```

Variants: `primary` (gradient, main CTA), `secondary` (surface + border, default choice for toolbars), `outline` (2px primary border, low-emphasis CTA), `danger` (gradient red, destructive/kill actions), `ghost` (transparent, icon-only or tertiary actions). Sizes: `sm` / `md` / `lg`. Pass `loading` to show a spinner and auto-disable.
