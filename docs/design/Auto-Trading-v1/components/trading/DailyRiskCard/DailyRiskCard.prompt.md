Composes two RiskMeters into the daily risk envelope panel — how much room before the engine stops itself.

```jsx
<DailyRiskCard dailyLoss={4200} maxDailyLoss={10000} tradesToday={7} maxTrades={10} halted={false} />
```

The loss meter is the important one: at 100% the circuit breaker trips the (persisted) kill switch.
