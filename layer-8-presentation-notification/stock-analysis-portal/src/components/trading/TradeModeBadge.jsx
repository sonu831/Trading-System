import React from 'react';
import PropTypes from 'prop-types';
import { FlaskConical, Eye, Zap, HelpCircle } from 'lucide-react';

/**
 * Dashboard rule U2: the trade mode is always visible and unmistakable.
 *
 * LIVE is deliberately loud (red + pulse + icon + the word LIVE). Nobody should
 * ever have to wonder whether the orders on screen are real.
 * Colour is never the only cue — every state ships an icon AND a label.
 */
const MODES = {
  paper: {
    label: 'PAPER',
    icon: FlaskConical,
    className: 'bg-surface border-border text-text-secondary',
    title: 'Paper mode — orders are simulated, no broker involved',
  },
  shadow: {
    label: 'SHADOW',
    icon: Eye,
    className: 'bg-warning/10 border-warning/40 text-warning',
    title: 'Shadow mode — signals are reported, you place orders manually',
  },
  live: {
    label: 'LIVE',
    icon: Zap,
    className: 'bg-error/15 border-error text-error animate-pulse',
    title: 'LIVE — real orders are being placed with real money',
  },
  unknown: {
    label: 'MODE UNKNOWN',
    icon: HelpCircle,
    className: 'bg-surface border-border text-text-tertiary',
    title: 'Execution engine unreachable — trade mode is unknown',
  },
};

export default function TradeModeBadge({ mode, className = '' }) {
  const key = mode && MODES[mode] ? mode : 'unknown';
  const { label, icon: Icon, className: modeClass, title } = MODES[key];

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider ${modeClass} ${className}`}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

TradeModeBadge.propTypes = {
  mode: PropTypes.oneOf(['paper', 'shadow', 'live']),
  className: PropTypes.string,
};
