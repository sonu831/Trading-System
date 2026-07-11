import React from 'react';
import RegimeCard from './RegimeCard';

export default {
  title: 'Trading/RegimeCard',
  component: RegimeCard,
  tags: ['autodocs'],
};

const trendingUp = {
  regime: {
    trend: 'TREND_UP',
    strength: 0.72,
    confidence: 0.85,
    volatility: 'NORMAL',
    phase: 'MOMENTUM',
    tfAlignment: { '5m': 1, '15m': 1, '1h': 1, D: 1 },
    tradeableTiers: ['T1', 'T2', 'T3'],
  },
  lastUpdatedAt: new Date(Date.now() - 5000).toISOString(),
};

const choppy = {
  regime: {
    trend: 'RANGE',
    strength: 0.15,
    confidence: 0.3,
    volatility: 'LOW',
    phase: 'ACCUMULATION',
    tfAlignment: { '5m': 0, '15m': 0, '1h': -1, D: 0 },
    tradeableTiers: ['T1'],
  },
  lastUpdatedAt: new Date(Date.now() - 120000).toISOString(),
};

const reversing = {
  regime: {
    trend: 'REVERSING',
    strength: 0.45,
    confidence: 0.55,
    volatility: 'HIGH',
    phase: 'DISTRIBUTION',
    tfAlignment: { '5m': -1, '15m': -1, '1h': 0, D: 1 },
    tradeableTiers: [],
  },
  lastUpdatedAt: new Date(Date.now() - 90000).toISOString(),
};

export const TrendingUp = { args: trendingUp };
export const Ranging = {
  name: 'Range / chop',
  args: choppy,
  parameters: { backgrounds: { default: 'dark' } },
};
export const Reversing = { args: reversing };
export const EngineOffline = { args: { reachable: false } };
export const NoData = { args: { regime: undefined, lastUpdatedAt: undefined } };
