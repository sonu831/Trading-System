// @ts-nocheck
import BrokerStatusBadge from './BrokerStatusBadge';

const BROKER_CONFIG = {
  mstock:     { name: 'mStock', fullName: 'Mirae Asset', color: 'border-l-blue-500', bg: 'bg-blue-900/30', text: 'text-blue-300', icon: '📊' },
  flattrade:  { name: 'FlatTrade', fullName: 'FlatTrade', color: 'border-l-green-500', bg: 'bg-green-900/30', text: 'text-green-300', icon: '📈' },
  kite:       { name: 'Kite', fullName: 'Zerodha', color: 'border-l-orange-500', bg: 'bg-orange-900/30', text: 'text-orange-300', icon: '🪁' },
  indianapi:  { name: 'IndianAPI', fullName: 'IndianAPI', color: 'border-l-purple-500', bg: 'bg-purple-900/30', text: 'text-purple-300', icon: '🇮🇳' },
};

const BrokerCard = ({ broker, onToggle, onSelect }) => {
  const config = BROKER_CONFIG[broker.provider] || { name: broker.provider, fullName: broker.provider, color: 'border-l-gray-500', bg: 'bg-gray-900/30', text: 'text-gray-300', icon: '🔌' };

  return (
    <div
      className={`bg-gray-800 rounded-lg border border-gray-700 border-l-4 ${config.color} p-4 hover:border-blue-400 transition cursor-pointer`}
      onClick={() => onSelect(broker)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h3 className={`text-lg font-semibold ${config.text}`}>{config.name}</h3>
            <span className="text-xs text-gray-500">{config.fullName} · {broker.role || 'data'}</span>
          </div>
        </div>
        <BrokerStatusBadge status={broker.status} />
      </div>

      {broker.credentials?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {broker.credentials.map((c) => (
            <span key={c.field_name} className={`text-xs px-2 py-0.5 rounded ${c.is_active ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-500'}`}>
              {c.field_name.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${broker.enabled ? 'text-green-400' : 'text-gray-500'}`}>
          {broker.enabled ? '● Enabled' : '○ Disabled'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(broker); }}
          className={`px-3 py-1 text-xs rounded transition ${broker.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
        >
          {broker.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  );
};

export default BrokerCard;
