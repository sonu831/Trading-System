Base surface container for grouping content — stat tiles, panels, list rows, modal bodies.

```jsx
<Card variant="default" padding="md">
  <CardHeader>Daily risk envelope</CardHeader>
  <CardBody>…</CardBody>
</Card>
```

`default` (white/slate surface + border) is the workhorse. `glass` (translucent + blur) is reserved for overlays atop charts/imagery. `outlined` (2px border, no fill) for low-emphasis grouping. `hoverable` adds a lift + primary-border hover, used for clickable cards (e.g. watchlist rows, top-picks tiles).
