# Layer 6: Signal Service ⚡

## **What is this?**

The Signal Layer is a **Node.js** service dedicated to decision making. This is the "Trader" persona of the system. It evaluates the aggregated market view and individual stock metrics against predefined **Trading Strategies** to generate actionable Buy/Sell signals.

## **Why is it needed?**

- **Automation**: Removes human emotion from entry/exit decisions.
- **Speed**: Can evaluate 50 stocks against 5 strategies in milliseconds.

## **How it works**

1.  **Strategy Engine**:
    - Loads strategies (e.g., `RSI_Divergence`, `Golden_Crossover`).
    - Each strategy has: `Name`, `Conditions`, `RiskProfile`.
2.  **Evaluation Loop**:
    - Consumes `analysis_updates` from Redis.
    - Checks if conditions match (e.g., `RSI < 30` AND `Price > EMA200`).
3.  **Confidence Scoring**:
    - Assigns a confidence score (0-100%) based on how strong the signal is (e.g., confluence of multiple indicators).
4.  **Alerting**:
    - Pushes the Signal to the `signals` list in Redis.
    - (Optional) Can trigger webhooks or Telegram alerts.

## **Key Logs & Monitoring**

- `[SIGNAL] BUY RELIANCE @ 2450 | Strat: DipBuy | Conf: 85%`: Clear audit trail of generated signals.

## **Extending Strategies**

New strategies can be added by creating a module in `src/strategies/` and registering it in the engine.
