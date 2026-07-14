// @ts-nocheck
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateBroker, saveCredentialsBulk } from '@/store/slices/brokerSlice';
import { addToast } from '@/store/slices/systemSlice';
import { BROKER_CAPABILITIES } from '@/shared/types';

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
  const [loading, setLoading] = useState(true);

  const toast = (type, text, title) => dispatch(addToast({ type, text, title }));

  useEffect(() => {
    if (!broker) return;
    setRole(broker.role || 'data');
    setPriority(broker.priority || 1);
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
  const handleFieldChange = (field, value) => setFormValues((prev) => ({ ...prev, [field]: value }));
  const toggleShow = (field) => setShowFields((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await dispatch(updateBroker({ id: broker.id, role, priority }));
      const credentials = fields.map((f) => ({ field_name: f, field_value: formValues[f] || '' }));
      const res = await dispatch(saveCredentialsBulk({ providerId: broker.id, credentials }));
      if (res.meta.requestStatus === 'fulfilled') {
        toast('success', 'All settings saved', 'Broker config');
      } else {
        toast('error', res.error?.message || 'Failed to save', 'Broker config');
      }
    } catch (err) {
      toast('error', err.message, 'Broker config');
    }
    setSaving(false);
  };

  if (!broker) return null;
  if (loading) return <div className="card text-text-tertiary text-sm text-center py-6">Loading credentials...</div>;

  const capCaps = BROKER_CAPABILITIES[broker.provider];
  const isExecRole = role === 'execution' || role === 'both';
  const unsafeExecutor = isExecRole && capCaps && !capCaps.restingStop;

  return (
    <div className="card">
      <h3 className="text-sm font-bold mb-4 capitalize">{broker.provider} Configuration</h3>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-xs text-text-tertiary block mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm">
            {['data', 'execution', 'both'].map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          {unsafeExecutor && (
            <p className="text-[10px] text-error mt-1">⚠️ {broker.provider} lacks resting stop-loss — will NOT function as OMS executor. Use FlatTrade for execution.</p>
          )}
        </div>
        <div>
          <label className="text-xs text-text-tertiary block mb-1">Priority</label>
          <input type="number" min={1} max={100} value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 1)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" />
        </div>
      </div>

      <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Credentials</h4>
      <div className="flex flex-col gap-3 mb-4">
        {fields.map((field) => (
          <div key={field} className="flex items-center gap-3">
            <label className="w-28 shrink-0 text-xs text-text-secondary">{FIELD_LABELS[field] || field}</label>
            <input
              type={showFields[field] ? 'text' : 'password'}
              value={formValues[field] || ''}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              placeholder={`Enter ${FIELD_LABELS[field] || field}`}
              className="flex-1 p-2 rounded-lg bg-surface border border-border text-text-primary text-sm"
            />
            <button type="button" onClick={() => toggleShow(field)} className="text-[11px] text-text-tertiary hover:text-text-secondary shrink-0">
              {showFields[field] ? 'Hide' : 'Show'}
            </button>
          </div>
        ))}
      </div>

      <button onClick={handleSaveAll} disabled={saving} className="btn-primary w-full justify-center text-sm">
        {saving ? 'Saving...' : 'Save All Settings'}
      </button>
    </div>
  );
};

export default BrokerForm;
