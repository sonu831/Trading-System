# Dashboard Feature

The main live market dashboard view.

## Components

- **MarketOverview**: Sentiment and A/D ratio.
- **TopMovers**: Carousel of top gainers/losers/sectors.
- **NiftyGrid**: Interactive grid of Nifty 50 stocks.
- **SignalsFeed**: Real-time signals table.
- **DashboardSkeleton**: Loading state.

## Usage

```jsx
import DashboardView from '@/components/features/Dashboard';

<DashboardView marketView={data} signals={signals} loading={loading} />;
```
