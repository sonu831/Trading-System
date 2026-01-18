# Layer 6: Signal Generation Instructions

## Overview

This layer consumes the aggregated market view from Layer 5 and the technical analysis from Layer 4. It runs the Decision Matrix logic to generate Buy/Sell signals.

## Development Guidelines

### Node.js Standards

- **Logic Isolation**: Keep trading logic separate from infrastructure code (Kafka/Redis).
- **Floating Point Math**: Use a library like `decimal.js` or careful handling to avoid floating point errors (e.g., `0.1 + 0.2`).

### Business Logic (The "Brain")

- **Decision Matrix**:
  - Input: Trend (25%), Breadth (20%), Momentum (15%), Options Chain (20%), Sectors (10%), Volatility (10%).
  - Output: Signal Confidence Score (0.0 to 1.0).
- **Risk Management**:
  - Always check "blocked symbols" list before signaling (e.g., earnings day exclusion).
  - Calculate recommended stop-loss and target based on ATR from Layer 4.

## Project Structure

```text
layer-6-signal/
├── src/
│   ├── engine/          # Core decision logic
│   ├── rules/           # Individual scoring rules
│   ├── risk/            # Risk management checks
│   └── index.js         # Entry point
├── tests/
│   └── scenarios/       # Backtesting scenarios
```

## Logging & Auditing

- **Audit Values**: Every signal MUST log the exact values of the inputs that triggered it.
  - "Signal generated because RSI=75 AND Breadth=Positive AND PCR=1.2".

```javascript
logger.info(
  {
    event: 'signal_generated',
    symbol: 'NIFTY',
    action: 'BUY',
    confidence: 0.85,
    inputs: {
      rsi: 75,
      pcr: 1.2,
      trend: 'bullish',
    },
  },
  'Buy signal generated'
);
```

## Testing

- **Scenario Testing**: Create mock scenarios (e.g., "The perfect storm") and verify the system generates a signal.
- **Negative Testing**: Feed conflicting data (e.g., Price rising but Options signalling bearish) and verify NO signal or LOW confidence.

```javascript
test('should generate strong buy signal on perfect conditions', () => {
  const inputs = { rsi: 35, pcr: 0.8, trend: 'bullish', ... };
  const signal = engine.evaluate(inputs);
  expect(signal.action).toBe('BUY');
  expect(signal.confidence).toBeGreaterThan(0.8);
});
```
