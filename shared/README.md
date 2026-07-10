# shared/ — Single Source of Truth

> **Every constant, type, enum, and interface used across layers lives here.** One import for everything.

## Quick Import

```js
// Node.js (CommonJS — one line, works everywhere)
const { KAFKA_TOPICS, PORTS, REDIS_KEYS } = require('/app/shared');
```

```go
// Go
import shared "github.com/utkarsh-pandey/nifty50-trading-system/shared"
```

```tsx
// TypeScript
import { KAFKA_TOPICS, PORTS, type TradeSignal } from '@shared';
```

## Files

| File | Runtime? | Content |
|------|----------|---------|
| `constants.js` | ✅ Runtime | REGIME, SIGNAL, KAFKA_TOPICS (11), PORTS (19), BROKER_URLS |
| `constants.ts` | 💻 IDE/tsc | Type-safe mirror of constants.js |
| `constants.go` | 🐹 Go | Go mirror — L4/L5 import |
| `types.ts` | 💻 | 25 interfaces: TradeSignal, Position, RegimeState |
| `ports.ts` | 💻 | 9 interfaces: ExecutionPort, MarketPort, OptionsPort |
| `index.js` | ✅ | CommonJS barrel: `require('/app/shared')` |
| `index.ts` | 💻 | TypeScript barrel |
| `health-check/` | ✅ | Kafka, Redis, TimescaleDB health checks |
| `kafka/` | ✅ | Notification producer/consumer |

## Rule

**Never hardcode a string that exists here.** KAFKA_TOPICS, PORTS, REDIS_KEYS — all defined once, imported everywhere.
