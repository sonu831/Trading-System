import BrokerStatusBadge from './BrokerStatusBadge';

const BROKER_NAMES = { mstock: 'mStock (Mirae Asset)', flattrade: 'FlatTrade', kite: 'Zerodha Kite', indianapi: 'IndianAPI' };

const BrokerCard = ({ broker, onToggle, onSelect }) => (
  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-blue-500 transition cursor-pointer" onClick={() => onSelect(broker)}>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="text-lg font-semibold text-white capitalize">{BROKER_NAMES[broker.provider] || broker.provider}</h3>
        <span className="text-xs text-gray-400 capitalize">{broker.role || 'data'}</span>
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
        {broker.enabled ? 'Enabled' : 'Disabled'}
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

export default BrokerCard;
