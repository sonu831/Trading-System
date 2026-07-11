import React from 'react';
import StatTile from './StatTile';

export default {
  title: 'Trading/StatTile',
  component: StatTile,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'positive', 'negative', 'warning'] },
    deltaTone: { control: 'select', options: ['neutral', 'positive', 'negative', 'warning'] },
  },
};

export const Neutral = { args: { label: 'Open Positions', value: '3', tone: 'neutral' } };
export const Positive = { args: { label: 'Day P&L', value: '+₹4,250', tone: 'positive', delta: '+2.4%', deltaLabel: 'vs open', deltaTone: 'positive' } };
export const Negative = { args: { label: 'Realised Loss', value: '-₹1,870', tone: 'negative', delta: '-0.8%', deltaLabel: 'of capital', deltaTone: 'negative' } };
export const Warning = { args: { label: 'Margin Used', value: '78%', tone: 'warning', footnote: 'Limit: ₹1,00,000' } };

export const WithIcon = { args: { label: 'Unrealised P&L', value: '+₹3,200', tone: 'positive', icon: '📈' } };
export const Unknown = { args: { label: 'Open Interest', value: null, tone: 'neutral' } };

export const DashboardTiles = {
  name: 'Dashboard row',
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', minWidth: '600px' }}>
      <StatTile label="Day P&L" value="+₹4,250" tone="positive" delta="+2.4%" deltaLabel="vs open" deltaTone="positive" />
      <StatTile label="Unrealised" value="+₹1,180" tone="positive" />
      <StatTile label="Trades Today" value="5 / 10" tone="warning" footnote="Daily limit" />
    </div>
  ),
};
