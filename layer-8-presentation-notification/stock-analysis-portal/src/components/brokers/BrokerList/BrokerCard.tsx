// @ts-nocheck
import BrokerStatusBadge from '@/components/brokers/BrokerList/BrokerStatusBadge';
import { BROKER_CAPABILITIES } from '@/shared/types';

const BROKER_CONFIG = {
  mstock:    { color: 'border-l-blue-500', bg: 'bg-info/10', text: 'text-info', icon: '📊' },
  flattrade: { color: 'border-l-green-500', bg: 'bg-success/10', text: 'text-success', icon: '📈' },
  kite:      { color: 'border-l-orange-500', bg: 'bg-warning/10', text: 'text-warning', icon: '🪁' },
  indianapi: { color: 'border-l-purple-500', bg: 'bg-accent/10', text: 'text-accent', icon: '🇮🇳' },
};

const BrokerCard = ({ broker, onToggle, onSelect }) => {
  const config = BROKER_CONFIG[broker.provider] || { color: 'border-l-border', bg: 'bg-surface-hover', text: 'text-text-secondary', icon: '🔌' };
  const caps = BROKER_CAPABILITIES[broker.provider];
  const isExecutorRole = broker.role === 'execution' || broker.role === 'both';
  const unsafeExecutor = isExecutorRole && caps && !caps.restingStop;

  return (
    <div
      className={`card border-l-4 ${config.color} hover:border-primary transition cursor-pointer`}
      onClick={() => onSelect(broker)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h3 className={`text-base font-bold ${config.text} capitalize`}>{broker.provider}</h3>
            <span className="text-xs text-text-tertiary">{broker.role || 'data'} · priority {broker.priority || 1}</span>
          </div>
        </div>
        <BrokerStatusBadge status={broker.status} />
      </div>

      {/* Capability warnings */}
      {unsafeExecutor && (
        <div className="mb-3 p-2 rounded bg-error/10 border border-error/20 text-error text-[11px] flex items-center gap-1.5">
          ⚠️ {broker.provider} does not support resting stop-loss — cannot be the OMS executor
        </div>
      )}

      {broker.credentials?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {broker.credentials.map((c) => (
            <span key={c.field_name} className={`text-[10px] px-2 py-0.5 rounded-full ${c.is_active ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-surface-hover text-text-tertiary'}`}>
              {c.field_name.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {caps && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {caps.dataFeed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-secondary">📡 Data Feed</span>}
          {caps.restingStop ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">🛡 Resting SL</span> : <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">⚠ No Resting SL</span>}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-tertiary">Max {caps.maxCandlesPerRequest} candles/req</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className={`text-xs font-semibold ${broker.enabled ? 'text-success' : 'text-text-tertiary'}`}>
          {broker.enabled ? '● Enabled' : '○ Disabled'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(broker); }}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition ${broker.enabled ? 'bg-error/15 text-error hover:bg-error/25' : 'bg-success/15 text-success hover:bg-success/25'}`}
        >
          {broker.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  );
};

export default BrokerCard;
