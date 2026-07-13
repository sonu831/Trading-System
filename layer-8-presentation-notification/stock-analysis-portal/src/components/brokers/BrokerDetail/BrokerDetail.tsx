// @ts-nocheck
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import BrokerForm from '@/components/brokers/BrokerDetail/BrokerForm';
import BrokerAuthTest from '@/components/brokers/BrokerDetail/MStockAuthFlow';
import BrokerStatusBadge from '@/components/brokers/BrokerList/BrokerStatusBadge';
import { fetchBrokers, enableBroker, disableBroker, selectBrokers } from '@/store/slices/brokerSlice';

const BrokerDetail = ({ id }) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const brokers = useSelector(selectBrokers);
  const broker = brokers.find((b) => b.id === parseInt(id));
  const [loading, setLoading] = useState(!broker);

  useEffect(() => {
    if (!brokers.length) { dispatch(fetchBrokers()).then(() => setLoading(false)); }
    else { setLoading(false); }
  }, [dispatch, brokers.length]);

  if (loading) return <div className="text-center py-12 text-text-tertiary">Loading...</div>;
  if (!broker) return <div className="text-center py-12 text-text-tertiary">Broker not found</div>;

  return (
    <div>
      <button onClick={() => router.push('/brokers')} className="text-text-tertiary hover:text-text-primary text-sm mb-4 inline-block">&larr; Back to Brokers</button>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary capitalize">{broker.provider}</h1>
          <BrokerStatusBadge status={broker.status} />
        </div>
        <button
          onClick={() => dispatch(broker.enabled ? disableBroker(broker.id) : enableBroker(broker.id))}
          className={`btn-primary text-xs ${broker.enabled ? '!bg-error !from-error !to-red-600' : ''}`}
          style={broker.enabled ? { background: 'rgb(var(--color-error))' } : {}}
        >
          {broker.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BrokerForm broker={broker} />
        <div className="flex flex-col gap-5">
          <BrokerAuthTest broker={broker} />
          <div className="card">
            <h3 className="text-sm font-bold mb-3">Connection Info</h3>
            <div className="space-y-2 text-sm">
              <div className="kv"><span className="text-text-secondary">Provider</span><span className="font-semibold capitalize">{broker.provider}</span></div>
              <div className="kv"><span className="text-text-secondary">Status</span><span className="font-semibold">{broker.status || 'N/A'}</span></div>
              <div className="kv"><span className="text-text-secondary">Enabled</span><span className={`font-semibold ${broker.enabled ? 'text-success' : 'text-error'}`}>{broker.enabled ? 'Yes' : 'No'}</span></div>
              <div className="kv"><span className="text-text-secondary">Priority</span><span className="font-semibold tabular-nums">{broker.priority || 1}</span></div>
              <div className="kv"><span className="text-text-secondary">Role</span><span className="font-semibold capitalize">{broker.role || 'data'}</span></div>
              {broker.last_tested_at && <div className="kv"><span className="text-text-secondary">Last Tested</span><span className="font-semibold">{new Date(broker.last_tested_at).toLocaleString()}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrokerDetail;
