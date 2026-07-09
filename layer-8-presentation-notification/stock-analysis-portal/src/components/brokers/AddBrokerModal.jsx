import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createBroker, selectBrokersLoading } from '@/store/slices/brokerSlice';

const PROVIDERS = [
  { value: 'mstock', label: 'mStock (Mirae Asset)' },
  { value: 'flattrade', label: 'FlatTrade' },
  { value: 'kite', label: 'Zerodha Kite' },
  { value: 'indianapi', label: 'IndianAPI' },
];

const ROLES = ['data', 'execution', 'both'];

const AddBrokerModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const loading = useSelector(selectBrokersLoading);
  const [provider, setProvider] = useState('mstock');
  const [role, setRole] = useState('data');
  const [priority, setPriority] = useState(1);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const result = await dispatch(createBroker({ provider, role, priority }));
    if (result.meta.requestStatus === 'fulfilled') {
      onClose();
    } else {
      setError(result.error?.message || result.payload || 'Failed to create provider');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Add Broker Provider</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Priority</label>
            <input type="number" min={1} max={100} value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 1)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBrokerModal;
