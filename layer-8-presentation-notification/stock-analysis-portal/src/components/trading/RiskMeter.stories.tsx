import React from 'react';
import RiskMeter from './RiskMeter';

export default {
  title: 'Trading/RiskMeter',
  component: RiskMeter,
  tags: ['autodocs'],
};

export const Safe = { args: { label: 'Daily Loss', used: 1200, limit: 5000, formatValue: (v) => `₹${v.toLocaleString('en-IN')}` } };
export const Warning = { args: { label: 'Daily Loss', used: 3800, limit: 5000, formatValue: (v) => `₹${v.toLocaleString('en-IN')}` } };
export const Danger = { args: { label: 'Daily Loss', used: 5100, limit: 5000, formatValue: (v) => `₹${v.toLocaleString('en-IN')}` } };

export const TradeCount = { args: { label: 'Trades Today', used: 8, limit: 10, formatValue: (v) => String(v) } };
export const NoData = { args: { label: 'Daily Loss', used: null, limit: null } };

export const AllLevels = {
  name: 'Safe → Danger ramp',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '320px' }}>
      <RiskMeter label="Daily Loss" used={1000} limit={5000} formatValue={(v) => `₹${v.toLocaleString('en-IN')}`} />
      <RiskMeter label="Daily Loss" used={3800} limit={5000} formatValue={(v) => `₹${v.toLocaleString('en-IN')}`} />
      <RiskMeter label="Daily Loss" used={5100} limit={5000} formatValue={(v) => `₹${v.toLocaleString('en-IN')}`} />
    </div>
  ),
};
