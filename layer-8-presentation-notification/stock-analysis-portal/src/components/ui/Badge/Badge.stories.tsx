import React from 'react';
import Badge from './Badge';

export default {
  title: 'Atoms/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'success', 'error', 'warning', 'info'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    children: { control: 'text' },
  },
};

export const Default = { args: { variant: 'default', children: 'Neutral' } };
export const Success = { args: { variant: 'success', children: 'Connected' } };
export const Error = { args: { variant: 'error', children: 'HALTED' } };
export const Warning = { args: { variant: 'warning', children: 'Stale' } };
export const Info = { args: { variant: 'info', children: 'Paper' } };

export const Small = { args: { size: 'sm', children: 'Sm' } };
export const Medium = { args: { size: 'md', children: 'Medium' } };
export const Large = { args: { size: 'lg', children: 'Large' } };

export const AllVariants = {
  name: 'All variants',
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Badge variant="default">Neutral</Badge>
      <Badge variant="success">BUY</Badge>
      <Badge variant="error">SELL</Badge>
      <Badge variant="warning">T1</Badge>
      <Badge variant="info">NIFTY</Badge>
    </div>
  ),
};
export const AllSizes = {
  name: 'All sizes',
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Badge variant="success" size="sm">Sm</Badge>
      <Badge variant="success" size="md">Medium</Badge>
      <Badge variant="success" size="lg">Large</Badge>
    </div>
  ),
};
export const TradingSignals = {
  name: 'Trading signals',
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Badge variant="success">BUY</Badge>
      <Badge variant="error">SELL</Badge>
      <Badge variant="info">HOLD</Badge>
      <Badge variant="warning">EXIT</Badge>
      <Badge variant="default">PENDING</Badge>
    </div>
  ),
};
