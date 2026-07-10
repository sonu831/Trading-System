// @ts-nocheck
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import BrokerCard from './BrokerCard';
import { fetchBrokers, enableBroker, disableBroker, selectBrokers, selectBrokersLoading } from '@/store/slices/brokerSlice';

const BrokerList = ({ onAddClick }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const brokers = useSelector(selectBrokers);
  const loading = useSelector(selectBrokersLoading);

  useEffect(() => { dispatch(fetchBrokers()); }, [dispatch]);

  const handleToggle = (broker) => {
    dispatch(broker.enabled ? disableBroker(broker.id) : enableBroker(broker.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Broker Credentials</h1>
        <button onClick={onAddClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
          + Add Broker
        </button>
      </div>

      {loading && brokers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Loading brokers...</div>
      ) : brokers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No brokers configured</p>
          <p className="text-sm">Add a broker provider to get started with market data and trading</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brokers.map((broker) => (
            <BrokerCard key={broker.id} broker={broker} onToggle={handleToggle} onSelect={(b) => router.push(`/brokers/${b.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BrokerList;
