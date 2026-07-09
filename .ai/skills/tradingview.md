# Skill: TradingView MCP Chart Analysis

> **For AI-assisted chart analysis, Pine Script development, and discretionary
> trading workflows.** Uses the `tradingview` MCP server (68 tools) over CDP.

## Architecture

```
Claude Code <-MCP-> MCP Server (stdio) <-CDP-> TradingView Desktop (Electron)
```

## Decision Tree: Which Tool to Use

| Task | Tool Category | Key Tools |
|------|--------------|-----------|
| What's on chart right now? | Chart state | `get_chart_state`, `get_visible_symbols` |
| Get price/OHLCV data | Price data | `get_ohlcv`, `get_current_price`, `get_volume` |
| Analyze chart visually | Chart analysis | `capture_screenshot`, `get_indicator_values` |
| Modify chart | Chart modification | `set_symbol`, `set_timeframe`, `apply_indicator` |
| Pine Script development | Pine | `get_pine_source`, `set_pine_source`, `compile_pine` |
| Multi-symbol screening | Batch | `batch_run`, scan watchlist |
| Navigate chart | UI | `pan_left`, `pan_right`, `zoom_in`, `zoom_out` |

## Key Conventions

1. **Use full indicator names** -- "Relative Strength Index", not "RSI"
2. **Always capture screenshot** after setting up chart -- visual confirmation
3. **One symbol at a time** -- TradingView MCP is not a streaming source
4. **Read `layer-1-tradingview/CLAUDE.md`** before using tools -- full guide there
5. **Read `layer-1-tradingview/rules.json`** for watchlist and bias criteria

## 12-Hour Update Workflow

Scheduled at 9:00 and 21:00 IST:
1. Scan NIFTY + BANKNIFTY on 1W, 1D, 4H timeframes
2. Apply indicators: RSI(14), MACD, EMA(21, 50), Volume
3. Classify bias: Bullish / Bearish / Neutral per rules.json criteria
4. Mark key support/resistance levels
5. Generate structured report
6. Save to `~/.tradingview-mcp/sessions/`

## Intraday Options Strategy

Trend-Pullback Continuation (15m filter / 10m trigger):
- Entry window: 09:45 - 14:30 IST
- Hard exit: 15:15 IST
- RSI long min: 52, RSI short max: 48
- Target: 2R, Stop: ATR-based with 0.1 buffer
- Max 2 signals per index per day
- Full spec: `layer-1-tradingview/strategies/nifty-banknifty-trend-pullback.md`
