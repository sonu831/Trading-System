import React from 'react';
import TradeModeBadge from './TradeModeBadge';

export default {
  title: 'Trading/TradeModeBadge',
  component: TradeModeBadge,
  tags: ['autodocs'],
};

export const Paper = { args: { mode: 'paper' } };
export const Shadow = { args: { mode: 'shadow' } };
export const Live = { args: { mode: 'live' } };
export const Unknown = { args: { mode: undefined } };

export const AllModes = {
  name: 'All modes',
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <TradeModeBadge mode="paper" />
      <TradeModeBadge mode="shadow" />
      <TradeModeBadge mode="live" />
      <TradeModeBadge />
    </div>
  ),
};
