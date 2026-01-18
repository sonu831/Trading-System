# Layer 5: Aggregation Service 📊

## **What is this?**

The Aggregation Layer is a **Golang** service that acts as the "Market Strategist". It takes individual stock analysis from Layer 4 and synthesizes the **Big Picture**. It answers questions like "Is the market Bullish?", "Which Sector is leading?", "What is the Advance/Decline ratio?".

## **Why is it needed?**

- **Macro View**: Trading decisions often depend on overall market sentiment, not just individual stock price.
- **Data Compression**: It processes mostly raw analysis data into consumable summaries (`MarketView`) for the Dashboard.

## **How it works**

1.  **Composite Scoring**:
    - Receives analyzed stocks.
    - Calculates a `CompositeScore` based on Trend + Momentum weights.
    - Determines Sentiment: **BULLISH**, **BEARISH**, or **NEUTRAL**.
2.  **Sector Analysis**:
    - Groups stocks by sector (e.g., IT, Banking, Auto).
    - Calculates average change and performance for each sector.
3.  **Market Breadth**:
    - Counts Advances (Stocks Green) vs Declines (Stocks Red).
    - Calculates A/D Ratio.
4.  **Pub/Sub Broadcasting**:
    - Compiles `MarketView` object.
    - Publishes to Redis Channel `market_view:latest` for the API/Dashboard.

## **Key Logs & Monitoring**

- `[INFO] 📊 Starting market aggregation...`: Indicates cycle start.
- `[INFO] ✅ Aggregation completed in 45ms | Sentiment: BULLISH`: High-level summary log.

## **Tech Stack**

- **Golang**: Leveraging strict typing for financial calculations.
- **Redis**: Heavily uses Redis for caching the "Latest State".
