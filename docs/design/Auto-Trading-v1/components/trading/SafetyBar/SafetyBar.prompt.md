Sticky bar that never scrolls away — underlying selector, live spot, and the two things a trader must always reach: trade-mode flag and kill switch.

```jsx
<SafetyBar underlying="NIFTY" spot={24812.3}
  tradeModeBadge={<TradeModeBadge mode="live" />}
  staleBadge={<StaleBadge timestamp={ts} />}
  killSwitchButton={<KillSwitchButton active={halted} onToggle={toggle} />} />
```

Composes TradeModeBadge / StaleBadge / KillSwitchButton as children rather than reimplementing them.
