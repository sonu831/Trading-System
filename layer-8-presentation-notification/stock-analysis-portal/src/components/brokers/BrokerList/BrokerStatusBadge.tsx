// @ts-nocheck
const STATUS_COLORS = {
  CONNECTED: 'bg-green-500',
  DISCONNECTED: 'bg-gray-500',
  DISABLED: 'bg-red-500',
  ERROR: 'bg-red-500',
};

const STATUS_LABELS = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Disconnected',
  DISABLED: 'Disabled',
  ERROR: 'Error',
};

const BrokerStatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status === 'CONNECTED' ? 'bg-green-900 text-green-300' : status === 'DISABLED' ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-300'}`}>
    <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status] || 'bg-gray-500'}`} />
    {STATUS_LABELS[status] || status || 'Unknown'}
  </span>
);

export default BrokerStatusBadge;
