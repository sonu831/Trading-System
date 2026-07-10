import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateBroker } from '@/store/slices/brokerSlice';

const ROLES = ['data', 'execution', 'both'];

const BrokerConfig = ({ broker }) => {
  const dispatch = useDispatch();
  const [role, setRole] = useState(broker?.role || 'data');
  const [priority, setPriority] = useState(broker?.priority || 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (broker) { setRole(broker.role || 'data'); setPriority(broker.priority || 1); }
  }, [broker]);

  const handleSave = async () => {
    setSaving(true);
    await dispatch(updateBroker({ id: broker.id, role, priority }));
    setSaving(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <button onClick={handleSave} disabled={saving} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Config'}
      </button>
    </div>
  );
};

export default BrokerConfig;
