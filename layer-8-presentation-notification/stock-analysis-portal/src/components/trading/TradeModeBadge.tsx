// @ts-nocheck
import React from 'react';
import { FlaskConical, Eye, Zap, HelpCircle, type LucideIcon } from 'lucide-react';
import type { TradeMode } from '@/shared/types';

interface ModeConfig { label: string; icon: LucideIcon; className: string; title: string; }

const MODES: Record<TradeMode | 'unknown', ModeConfig> = {
  paper:   { label: 'PAPER', icon: FlaskConical, className: 'bg-surface border-border text-text-secondary', title: 'Paper mode — orders are simulated, no broker involved' },
  shadow:  { label: 'SHADOW', icon: Eye, className: 'bg-warning/10 border-warning/40 text-warning', title: 'Shadow mode — signals are reported, you place orders manually' },
  live:    { label: 'LIVE', icon: Zap, className: 'bg-error/15 border-error text-error animate-pulse', title: 'LIVE — real orders are being placed with real money' },
  unknown: { label: 'MODE UNKNOWN', icon: HelpCircle, className: 'bg-surface border-border text-text-tertiary', title: 'Execution engine unreachable' },
};

export default function TradeModeBadge({ mode, className = '' }: { mode?: TradeMode; className?: string }) {
  const key: TradeMode | 'unknown' = mode && mode in MODES ? mode : 'unknown';
  const { label, icon: Icon, className: modeClass, title } = MODES[key];
  return (
    <span title={title} aria-label={title} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider ${modeClass} ${className}`}>
      <Icon size={14} aria-hidden="true" />{label}
    </span>
  );
}
