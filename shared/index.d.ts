// ═══════════════════════════════════════════════════════════
// shared/index.d.ts — types for the CommonJS barrel in index.js
//
// Every layer imports from ONE place:
//   import { REGIME_TREND, KAFKA_TOPICS, PORTS, type TradeSignal } from '@shared';
//   const  { KAFKA_TOPICS, PORTS } = require('/app/shared');
//
// There is deliberately NO index.ts. A `.ts` twin beside `index.js` means `require()`
// loads one file while tsc/tsx type-check the other — the same split that let
// `constants.js` ship with 2 of 17 exports while the type-checker saw all 17.
// `shared/tests/no-ts-js-twins.test.js` enforces this.
// ═══════════════════════════════════════════════════════════

export type * from './types';
export type * from './ports';
export * from './constants';
