import React from 'react';
import ConfluenceChecklist from './ConfluenceChecklist';

export default {
  title: 'Organisms/ConfluenceChecklist',
  component: ConfluenceChecklist,
  tags: ['autodocs'],
};

export const AllPass = {
  args: {
    regime: { trend: 'TREND_UP', strength: 0.72, phase: 'BREAKOUT' },
    breadth: { adRatio: 1.5 },
    vix: 15.2,
  },
};

export const PartialPass = {
  args: {
    regime: { trend: 'RANGE', strength: 0.25, phase: 'ACCUMULATION' },
    breadth: { adRatio: 1.1 },
    vix: 25,
  },
};

export const AllFail = {
  args: {
    regime: { trend: 'TREND_DOWN', strength: 0.1, phase: 'EXHAUSTION' },
    breadth: { adRatio: 0.6 },
    vix: 35,
  },
};

export const NoData = {
  args: { regime: {}, breadth: {}, vix: undefined },
};
