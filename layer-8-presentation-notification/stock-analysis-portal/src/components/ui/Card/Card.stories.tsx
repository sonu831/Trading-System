import React from 'react';
import Card, { CardHeader, CardBody, CardFooter } from './Card';

export default {
  title: 'Atoms/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'glass', 'outlined'] },
    padding: { control: 'select', options: ['none', 'sm', 'md', 'lg'] },
    hoverable: { control: 'boolean' },
  },
};

export const Default = { args: { children: 'Default card content', variant: 'default' } };
export const Glass = { args: { variant: 'glass', children: 'Glass morphism card' }, parameters: { backgrounds: { default: 'dark' } } };
export const Outlined = { args: { variant: 'outlined', children: 'Outlined card' } };
export const Hoverable = { args: { hoverable: true, children: 'Hover me — I lift' } };

export const WithHeader = {
  render: () => (
    <Card>
      <CardHeader>Signal Summary</CardHeader>
      <CardBody>RSI: 62 | MACD: Bullish | Trend: UP</CardBody>
    </Card>
  ),
};
export const WithFooter = {
  render: () => (
    <Card>
      <CardHeader>Risk Envelope</CardHeader>
      <CardBody>Daily loss: ₹1,200 / ₹5,000</CardBody>
      <CardFooter>
        <span className="text-sm text-text-tertiary">Updated 3m ago</span>
      </CardFooter>
    </Card>
  ),
};
export const FullStructure = {
  name: 'Header + Body + Footer',
  render: () => (
    <Card>
      <CardHeader>Position Summary</CardHeader>
      <CardBody>
        <p>Open positions: 2</p>
        <p>Unrealised P&L: +₹1,450</p>
      </CardBody>
      <CardFooter>
        <span className="text-xs text-text-tertiary">Last trade: 14:52 IST</span>
      </CardFooter>
    </Card>
  ),
};
export const NoPadding = { args: { padding: 'none', children: <div className="bg-surface-hover h-20 rounded-xl" /> } };
export const AllVariants = {
  name: 'All variants',
  render: () => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      <Card variant="default"><CardHeader>Default</CardHeader><CardBody>Standard surface card</CardBody></Card>
      <Card variant="glass"><CardHeader>Glass</CardHeader><CardBody>Frosted glass effect</CardBody></Card>
      <Card variant="outlined"><CardHeader>Outlined</CardHeader><CardBody>Border-only card</CardBody></Card>
    </div>
  ),
};
