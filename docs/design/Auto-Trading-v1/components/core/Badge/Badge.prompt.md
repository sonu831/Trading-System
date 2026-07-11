Small status label — action outcomes (BUY/SELL), health states, counts.

```jsx
<Badge variant="success">BUY</Badge>
```

Variants map 1:1 to the semantic color tokens: `default` (neutral/border), `success`, `error`, `warning`, `info`. Never rely on color alone for trading actions — pair with text (see PositionsTable, TradeModeBadge for that pattern).
