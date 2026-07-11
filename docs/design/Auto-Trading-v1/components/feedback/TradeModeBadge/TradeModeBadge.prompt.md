Always-visible flag telling the trader whether orders are simulated or real money.

```jsx
<TradeModeBadge mode="live" />
```

`paper` (neutral, simulated), `shadow` (amber, signals only — you place orders manually), `live` (red + pulsing — real money). Lives in the persistent nav/safety bar, never buried in a settings page.
