// @ts-nocheck
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createBroker, selectBrokersLoading } from '@/store/slices/brokerSlice';

const PROVIDERS = [
  { value: 'mstock', label: 'mStock (Mirae Asset)' },
  { value: 'flattrade', label: 'FlatTrade' },
  { value: 'kite', label: 'Zerodha Kite' },
  { value: 'indianapi', label: 'IndianAPI' },
];

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
    if (result.meta.requestStatus === 'fulfilled') { onClose(); }
    else { setError(result.error?.message || result.payload || 'Failed to create provider'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Add Broker Provider</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-error text-xs">{error}</div>}

          <div>
            <label className="text-xs text-text-tertiary block mb-1">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm">
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-tertiary block mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm">
              {['data', 'execution', 'both'].map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-tertiary block mb-1">Priority</label>
            <input type="number" min={1} max={100} value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 1)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary text-sm transition">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center text-sm">{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBrokerModal;
