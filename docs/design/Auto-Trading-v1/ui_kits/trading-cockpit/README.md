# Trading Cockpit — Mobile UI Kit

A mobile-first, single-scroll-per-tab recreation of the `stock-analysis-portal` product, built
for fast on-the-go scalping and positional monitoring.

## Screens (bottom tab bar)

1. **Dashboard** — market sentiment, NIFTY/BANKNIFTY sparklines, watchlist, live signals feed.
2. **Scalp** — sticky safety bar (spot/mode/kill switch), price chart, live option chain
   (CALLS · STRIKE · PUTS), Engine Intent strike preview, sticky quick-execute ticket at the
   bottom (BUY CE / BUY PE / square-off).
3. **Positional** — option-selling perspective: book-level P&L/theta/delta, daily risk envelope,
   per-position Greeks cards (IV, theta, delta, stop).
4. **Backfill** — historical-candle backfill progress, per-symbol status list, pause/resume.
5. **Brokers** — per-user account strip + broker connection cards + add-broker modal (API
   key/secret scoped to the signed-in account).

## Why mobile-first / bottom tabs

The source app (`CockpitTemplate.tsx`) is a desktop 3-column CSS grid with no mobile layout
defined. This kit is new interaction design built to the brief ("mobile friendly... HFT... one or
two pages... easy to see") rather than a literal recreation — see readme.md Caveats.

## Data

All data in `data.js` is static/randomized mock data (`window.MOCK`), regenerated on reload. No
network calls. `window.CURRENT_USER` stands in for session/auth context.
