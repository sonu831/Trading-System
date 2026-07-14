Announces whether the data next to it can be trusted right now — words carry the meaning, color reinforces it.

```jsx
<StaleBadge timestamp={regime.updatedAt} />
```

Thresholds: fresh under 30s (quiet gray), warn at 30s+ (amber), stale at 2min+ (red, explicit "do not trade on this" copy). Never a silent color-only cue — always pair a badge like this with any live feed (quotes, regime, signals) in an HFT UI.
