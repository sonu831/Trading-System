import React from 'react';
import Button from './Button';

export default {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'danger', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    onClick: { action: 'clicked' },
    children: { control: 'text' },
  },
};

export const Primary = { args: { variant: 'primary', children: 'Primary Button' } };
export const Secondary = { args: { variant: 'secondary', children: 'Secondary' } };
export const Outline = { args: { variant: 'outline', children: 'Outline' } };
export const Danger = { args: { variant: 'danger', children: 'Delete' } };
export const Ghost = { args: { variant: 'ghost', children: 'Ghost' } };

export const Small = { args: { size: 'sm', children: 'Small' } };
export const Medium = { args: { size: 'md', children: 'Medium' } };
export const Large = { args: { size: 'lg', children: 'Large' } };

export const Disabled = { args: { disabled: true, children: 'Disabled' } };
export const Loading = { args: { loading: true, children: 'Loading...' } };
export const WithIcon = {
  args: { variant: 'primary', children: '← Back' },
  name: 'With text content',
};
export const FullVariants = {
  name: 'All variants',
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};
export const AllSizes = {
  name: 'All sizes',
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
export const States = {
  name: 'States',
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <Button>Normal</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};
