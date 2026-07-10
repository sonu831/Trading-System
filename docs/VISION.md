# VISION.md — What We're Building and Why

> **Owner:** Yogendra | **Updated:** 2026-07-10

## One Sentence

A production-grade, event-driven algorithmic trading platform that ingests Nifty 50 market data, computes multi-timeframe regime + indicators, generates breadth-confirmed momentum signals, and executes options trades with fail-closed safety — all controlled from a single dashboard cockpit.

## Three Planes

The system splits into three planes, each with a single responsibility:

```
┌─────────────────── CONTROL PLANE ───────────────────┐
│  Dashboard → API → Config DB + Redis Command Bus     │
│  Providers · Strategies · Risk · Kill Switch         │
│  "Configure everything from the browser. No redeploy."│
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼───────── DATA PLANE ────────────┐
│  L1 Ingestion → L2 Processing → L4 Analysis →        │
│  L5 Aggregation → L6 Signal → L10 Execution          │
│  "Market data flows left to right on Kafka.           │
│   One job per layer. One input, one output."         │
└────────────────────┬────────────────────────────────┘
                     │ stores regime + outcomes
┌────────────────────▼──────── RESEARCH PLANE ─────────┐
│  Regime Snapshots DB → k-NN Analog Search → Reports  │
│  "What happened the last 10 times the market         │
│   looked exactly like this?"                         │
│  Advisory only. Never a hard trigger.                │
└──────────────────────────────────────────────────────┘
```

## What We Trade

| Profile | Instrument | Timeframe | Holding |
|---------|-----------|-----------|---------|
| **T1 · Scalp** | ITM-1 CE/PE, weekly | 1m/5m | 1–15 min |
| **T2 · Intraday** | ATM/ITM-1 CE/PE, weekly | 15m/1h | 30 min–few hours |
| **T3 · Positional** | ITM-1, next weekly/monthly | 1h/Daily | 1–3 days (overnight) |

**Rules:** Long premium only (buy CE/PE, never sell to open). Entry+stop are atomic. Broker-side resting SL-M. Kill switch persisted.

## What the Dashboard Shows

One page (`/scalp`) carries everything needed to take (or refuse) a scalp:

```
┌──── SafetyBar: mode · kill switch · countdown ────────┐
│ NIFTY · 25,113 · PAPER · 15:00 in 2h14m · [KILL]     │
├──────────┬─────────────┬──────────────────────────────┤
│ Chart    │ Day P&L     │ Option Chain (CE|STRIKE|PE) │
│ 1m/5m    │ Risk meters │ PCR · Max Pain · OI Buildup │
│ VWAP/EMA │ Regime      │                              │
│ Volume   │ Breadth     │                              │
├──────────┴─────────────┴──────────────────────────────┤
│ Positions · Signals · Historical Analogs               │
└───────────────────────────────────────────────────────┘
```

## Safety Invariants (Non-Negotiable)

1. **Only buy premium** — Bullish → CE, bearish → PE. Never sell to open
2. **Entry+stop atomic** — Fill confirmed → SL-M placed. SL fails → market exit
3. **Broker is source of truth** — Open on confirmed fill at broker's avg price
4. **Every order has unique ordertag** — Retry cannot double-fire
5. **Kill switch persisted** — Restart cannot resume a breaker trip
6. **Live fails closed** — OMS without SL-M support → refuse to construct

## What We Don't Do

- **No naked shorts** — unbounded risk
- **No tick-edge HFT** — we capture 1m–multi-hour moves, not sub-second edges
- **No direct broker sockets outside L1+L10** — single gateway rule
- **No hardcoded secrets** — encrypted credential vault, env vars for bootstrap only
- **No confident zeros** — absent data renders `—`, never `0`

## Roadmap

```
Now      ████████████  All 4 phases built · 82% audit compliance · 31 tests
Next     ████████░░    MStock live TOTP · Research Plane R1 (regime snapshots)
Later    ██████░░░░    Research Plane R2-R4 (k-NN analogs) · Python LSTM training
Future   ████░░░░░░    Multi-broker live · Positional T3 profiles · Real P&L
```

## Principles

| # | Principle |
|---|-----------|
| 1 | **One job per layer** — L1 ingests, L2 builds candles, L4 computes indicators. Never "also handles auth" |
| 2 | **Fail closed** — A degraded dependency surfaces as an error, never a default value |
| 3 | **Unknown ≠ zero** — `null`/`—`/throw. Never `|| 0` on a trading screen |
| 4 | **No redeploy** — Providers, strategies, risk — all configurable from the dashboard at runtime |
| 5 | **Verify by execution** — Docs are not evidence. Run `npm run verify` before claiming something works |
| 6 | **shared/ is single source of truth** — Constants, types, enums in ONE place. Never re-declare |
