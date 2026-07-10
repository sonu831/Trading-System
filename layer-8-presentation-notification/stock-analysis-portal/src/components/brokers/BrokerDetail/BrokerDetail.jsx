import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import BrokerConfig from './BrokerConfig';
import CredentialForm from './CredentialForm';
import MStockAuthFlow from './MStockAuthFlow';
import BrokerStatusBadge from '@/components/brokers/BrokerList/BrokerStatusBadge';
import { fetchBrokers, enableBroker, disableBroker, selectBrokers } from '@/store/slices/brokerSlice';

const BrokerDetail = ({ id }) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const brokers = useSelector(selectBrokers);
  const broker = brokers.find((b) => b.id === parseInt(id));
  const [loading, setLoading] = useState(!broker);

  useEffect(() => {
    if (!brokers.length) {
      dispatch(fetchBrokers()).then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [dispatch, brokers.length]);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!broker) return <div className="text-center py-12 text-gray-400">Broker not found</div>;

  const apiKeyCred = broker.credentials?.find((c) => c.field_name === 'api_key');

  return (
    <div>
      <button onClick={() => router.push('/brokers')} className="text-gray-400 hover:text-white text-sm mb-4 inline-block">&larr; Back to Brokers</button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white capitalize">{broker.provider}</h1>
          <BrokerStatusBadge status={broker.status} />
        </div>
        <button
          onClick={() => dispatch(broker.enabled ? disableBroker(broker.id) : enableBroker(broker.id))}
          className={`px-4 py-2 text-white rounded-lg text-sm transition ${broker.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {broker.enabled ? 'Disable Provider' : 'Enable Provider'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <BrokerConfig broker={broker} />
          <CredentialForm broker={broker} />
        </div>
        <div className="space-y-6">
          {broker.provider === 'mstock' && (
            <MStockAuthFlow broker={broker} apiKey={apiKeyCred?.value} />
          )}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Connection Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Provider</span><span className="text-white capitalize">{broker.provider}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Status</span><span className="text-white">{broker.status || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Enabled</span><span className={broker.enabled ? 'text-green-400' : 'text-red-400'}>{broker.enabled ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Priority</span><span className="text-white">{broker.priority || 1}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Role</span><span className="text-white capitalize">{broker.role || 'data'}</span></div>
              {broker.last_tested_at && <div className="flex justify-between"><span className="text-gray-400">Last Tested</span><span className="text-white">{new Date(broker.last_tested_at).toLocaleString()}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrokerDetail;
