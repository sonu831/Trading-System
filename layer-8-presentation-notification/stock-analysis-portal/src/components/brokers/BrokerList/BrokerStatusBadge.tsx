// @ts-nocheck
const BrokerStatusBadge = ({ status }) => (
  <span className={`badge text-xs font-bold px-2.5 py-1 rounded-full border ${status === 'CONNECTED' ? 'badge-ok' : status === 'ERROR' || status === 'DISABLED' ? 'badge-err' : 'badge-warn'}`}>
    {status || 'Unknown'}
  </span>
);

export default BrokerStatusBadge;
