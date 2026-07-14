Halts all new entries / flattens positions — must be reachable from every screen and on mobile.

```jsx
<KillSwitchButton active={killSwitch} onToggle={handleToggle} />
```

Halting needs one confirmation; resuming (the riskier direction after a circuit-breaker trip) is deliberately made to feel weightier. Always mount this in the persistent nav bar, never only inside a settings page.
