import React from 'react';
import PropTypes from 'prop-types';
import { Card } from '@/components/ui';

export const AdvanceDeclineCard = ({ advances, declines, total }) => {
  return (
    <Card variant="glass" className="flex flex-col justify-center">
      <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-3">Advance / Decline</h3>
      <div className="flex items-center justify-between w-full gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">{advances}</p>
          <span className="text-xs text-slate-500">Advances</span>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-center">
          <p className="text-2xl font-bold text-rose-400">{declines}</p>
          <span className="text-xs text-slate-500">Declines</span>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-200">{total}</p>
          <span className="text-xs text-slate-500">Total</span>
        </div>
      </div>
    </Card>
  );
};

AdvanceDeclineCard.propTypes = {
  advances: PropTypes.number,
  declines: PropTypes.number,
  total: PropTypes.number,
};
