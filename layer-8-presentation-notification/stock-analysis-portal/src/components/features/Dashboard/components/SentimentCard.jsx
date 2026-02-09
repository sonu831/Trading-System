import React from 'react';
import PropTypes from 'prop-types';
import { Card, Badge } from '@/components/ui';

export const SentimentCard = ({ sentiment }) => {
  const getSentimentColor = (s) => {
    switch (s?.toLowerCase()) {
      case 'bullish': return 'success';
      case 'bearish': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card variant="glass" className="flex items-center justify-between">
      <div>
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Market Sentiment</h3>
        <p className="text-2xl font-bold text-slate-100 mt-1">{sentiment || 'Neutral'}</p>
      </div>
      <Badge variant={getSentimentColor(sentiment)} size="lg">
        {sentiment || 'Neutral'}
      </Badge>
    </Card>
  );
};

SentimentCard.propTypes = {
  sentiment: PropTypes.string,
};
