import React from 'react';
import StaleBadge from './StaleBadge';

export default {
  title: 'Trading/StaleBadge',
  component: StaleBadge,
  tags: ['autodocs'],
};

export const Fresh = { args: { staleness: { status: 'fresh', seconds: 3 } } };
export const Stale = { args: { staleness: { status: 'stale', seconds: 45 } } };
export const Unknown = { args: { staleness: undefined } };
