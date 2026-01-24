import React from 'react';
import PropTypes from 'prop-types';
import { Card } from '@/components/ui';
import { useMounted } from '@/hooks';

const MarketOverview = ({ marketView }) => {
  const isMounted = useMounted();
  const sentiment = marketView?.marketSentiment || 'Neutral';
  const advances = marketView?.advanceDecline?.advances || 0;
  const declines = marketView?.advanceDecline?.declines || 0;
  const total = advances + declines || 1;
  const adRatio = (advances / declines || 0).toFixed(2);

  const getSentimentIcon = (s) => {
    switch (s) {
      case 'BULLISH':
        return '🐂';
      case 'BEARISH':
        return '🐻';
      default:
        return '⚖️';
    }
  };

  const getSentimentColor = (s) => {
    switch (s) {
      case 'BULLISH':
        return 'text-success';
      case 'BEARISH':
        return 'text-error';
      default:
        return 'text-warning';
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
      {/* Market Sentiment Card */}
      <Card className="relative overflow-hidden group border-border hover:border-primary/50 transition duration-300">
        <div className="absolute -right-6 -top-6 text-9xl opacity-5 grayscale group-hover:grayscale-0 group-hover:opacity-10 transition duration-500 select-none">
          {getSentimentIcon(sentiment)}
        </div>

        <h3 className="text-text-tertiary text-xs font-bold uppercase tracking-wider mb-2">
          Market Sentiment
        </h3>
        <div
          className={`text-2xl md:text-3xl lg:text-4xl font-extrabold flex items-center gap-2 md:gap-3 ${getSentimentColor(sentiment)}`}
        >
          <span className="animate-bounce-slow text-3xl md:text-4xl shrink-0">
            {getSentimentIcon(sentiment)}
          </span>
          <span className="truncate">{sentiment || 'NEUTRAL'}</span>
        </div>
        <div className="text-xs text-text-tertiary mt-2 font-mono">
          Updated: {isMounted ? new Date().toLocaleTimeString() : ''}
        </div>
      </Card>

      {/* Advance / Decline Meter */}
      <Card className="border-border hover:border-accent/50 transition duration-300">
        <h3 className="text-text-tertiary text-xs font-bold uppercase tracking-wider mb-2">
          Advance / Decline
        </h3>
        <div className="flex items-end justify-between gap-4 mb-2">
          <div className="shrink-0">
            <div className="text-2xl md:text-3xl font-extrabold text-text-primary">{adRatio}</div>
            <div className="text-[10px] uppercase tracking-tighter text-text-tertiary">
              A/D Ratio
            </div>
          </div>
          <div className="text-right text-xs font-bold">
            <div className="text-success">{advances} Advances 🟢</div>
            <div className="text-error">{declines} Declines 🔴</div>
          </div>
        </div>

        {/* Improved Meter */}
        <div className="relative h-4 bg-background rounded-full overflow-hidden shadow-inner border border-border">
          {/* Center Marker */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-text-primary/30 z-10"></div>

          <div className="flex h-full w-full">
            <div
              className="bg-gradient-to-r from-success/40 to-success h-full transition-all duration-700 ease-out"
              style={{ width: `${(advances / total) * 100}%` }}
            ></div>
            <div
              className="bg-gradient-to-l from-error/40 to-error h-full transition-all duration-700 ease-out"
              style={{ width: `${(declines / total) * 100}%` }}
            ></div>
          </div>
        </div>
      </Card>
    </section>
  );
};

MarketOverview.propTypes = {
  marketView: PropTypes.shape({
    breadth: PropTypes.shape({
      market_sentiment: PropTypes.string,
      advances: PropTypes.number,
      declines: PropTypes.number,
      advance_decline_ratio: PropTypes.number,
    }),
  }),
};

export default MarketOverview;
