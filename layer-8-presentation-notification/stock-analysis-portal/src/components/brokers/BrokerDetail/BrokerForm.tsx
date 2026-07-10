// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateBroker, saveCredentialsBulk } from '@/store/slices/brokerSlice';

const ROLES = ['data', 'execution', 'both'];

const BROKER_FORM_FIELDS = {
  mstock:    ['api_key', 'client_code', 'password', 'totp_secret'],
  flattrade: ['api_key', 'api_secret', 'access_token'],
  kite:      ['api_key', 'api_secret', 'access_token'],
  indianapi: ['api_key'],
};

const FIELD_LABELS = {
  api_key: 'API Key', api_secret: 'API Secret', client_code: 'Client Code',
  password: 'Password', totp_secret: 'TOTP Secret', access_token: 'Access Token',
};

const BrokerForm = ({ broker }) => {
  const dispatch = useDispatch();
  const fields = BROKER_FORM_FIELDS[broker?.provider] || [];

  const [formValues, setFormValues] = useState({});
  const [role, setRole] = useState(broker?.role || 'data');
  const [priority, setPriority] = useState(broker?.priority || 1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!broker) return;
    setRole(broker.role || 'data');
    setPriority(broker.priority || 1);
    // Fetch decrypted credentials from backend — Redux list has masked values
    const fetchCreds = async () => {
      try {
        const res = await fetch(`/api/v1/providers/${broker.provider}/credentials/decrypted`);
        const data = await res.json();
        if (data.success && data.data?.credentials) {
          const vals = {};
          fields.forEach((f) => { vals[f] = data.data.credentials[f] || ''; });
          setFormValues(vals);
        }
      } catch (_) {}
      setLoading(false);
    };
    fetchCreds();
  }, [broker]);

  const [showFields, setShowFields] = useState({});

  const handleFieldChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const toggleShow = (field) => {
    setShowFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Save config (role, priority)
      await dispatch(updateBroker({ id: broker.id, role, priority }));

      // Build credential array from form values
      const credentials = fields.map((f) => ({
        field_name: f,
        field_value: formValues[f] || '',
      }));

      const res = await dispatch(saveCredentialsBulk({ providerId: broker.id, credentials }));
      if (res.meta.requestStatus === 'fulfilled') {
        setMessage({ type: 'success', text: 'All settings saved' });
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setSaving(false);
  };

  if (!broker) return null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">{BROKER_FORM_FIELDS[broker.provider] ? broker.provider.toUpperCase() + ' Configuration' : 'Configuration'}</h3>

      {/* Config */}
      <div className="grid grid-cols-2 gap-4 mb-6">
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

      {/* Credential fields — one per row, ordered by provider */}
      <h4 className="text-sm font-medium text-gray-400 mb-3">Credentials</h4>
      <div className="space-y-3 mb-4">
        {fields.map((field) => (
          <div key={field} className="flex items-center gap-3">
            <label className="w-28 flex-shrink-0 text-sm text-gray-300">{FIELD_LABELS[field] || field}</label>
            <input
              type={showFields[field] ? 'text' : 'password'}
              value={formValues[field] || ''}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              placeholder={`Enter ${FIELD_LABELS[field] || field}`}
              className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-white text-sm placeholder-gray-500"
            />
            <button
              type="button"
              onClick={() => toggleShow(field)}
              className="text-xs text-gray-400 hover:text-white flex-shrink-0"
            >
              {showFields[field] ? 'Hide' : 'Show'}
            </button>
          </div>
        ))}
      </div>

      {/* One Save All button */}
      {message && (
        <div className={`mb-3 p-2 rounded text-xs ${message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
          {message.text}
        </div>
      )}
      <button
        onClick={handleSaveAll}
        disabled={saving}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save All Settings'}
      </button>
    </div>
  );
};

export default BrokerForm;
