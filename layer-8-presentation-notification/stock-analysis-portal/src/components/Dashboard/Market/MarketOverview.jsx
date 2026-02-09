import React from 'react';
import PropTypes from 'prop-types';
import { useMounted } from '@/hooks';
import { SentimentCard } from './SentimentCard';
import { AdvanceDeclineCard } from './AdvanceDeclineCard';
import { Card } from '@/components/ui';

const MarketOverview = ({ marketView }) => {
  const isMounted = useMounted();
  const sentiment = marketView?.marketSentiment || 'Neutral';
  const advances = marketView?.advanceDecline?.advances || 0;
  const declines = marketView?.advanceDecline?.declines || 0;
  const total = advances + declines || 0; 

  if (!isMounted) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* 1. Market Sentiment */}
      <SentimentCard sentiment={sentiment} />

      {/* 2. Advance / Decline */}
      <AdvanceDeclineCard advances={advances} declines={declines} total={total} />

      {/* 3. Nifty 50 Status */}
       <Card variant="glass" className="flex flex-col justify-center">
         <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Nifty 50</h3>
         <div className="flex items-baseline gap-2">
           <span className="text-2xl font-bold text-slate-100">23,540.25</span>
           <span className="text-sm text-emerald-400">+120.50 (0.65%)</span>
         </div>
       </Card>

      {/* 4. VIX / Volatility */}
      <Card variant="glass" className="flex flex-col justify-center">
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">India VIX</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100">11.20</span>
          <span className="text-sm text-rose-400">-0.45 (3.2%)</span>
        </div>
      </Card>
    </div>
  );
};

MarketOverview.propTypes = {
  marketView: PropTypes.shape({
    marketSentiment: PropTypes.string,
    advanceDecline: PropTypes.shape({
      advances: PropTypes.number,
      declines: PropTypes.number,
    }),
  }),
};

export default MarketOverview;
