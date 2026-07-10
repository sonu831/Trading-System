// @ts-nocheck
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import CredentialField from './CredentialField';
import { saveCredential } from '@/store/slices/brokerSlice';

const CREDENTIAL_FIELDS = ['api_key', 'client_code', 'password', 'totp_secret'];

const CredentialForm = ({ broker }) => {
  const dispatch = useDispatch();
  const existingFields = broker?.credentials?.map((c) => c.field_name) || [];
  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState('api_key');
  const [newValue, setNewValue] = useState('');

  const handleSave = async (fieldName, fieldValue) => {
    await dispatch(saveCredential({ providerId: broker.id, field_name: fieldName, field_value: fieldValue }));
  };

  const handleAddNew = async () => {
    if (!newValue.trim()) return;
    await handleSave(newField, newValue);
    setNewValue('');
    setShowAdd(false);
  };

  if (!broker) return null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Credentials</h3>
        {!showAdd && <button onClick={() => setShowAdd(true)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition">+ Add</button>}
      </div>

      <div className="space-y-1">
        {broker.credentials?.map((c) => (
          <CredentialField key={c.field_name} fieldName={c.field_name} value={c.value || ''} isActive={c.is_active} onSave={handleSave} />
        ))}
      </div>

      {showAdd && (
        <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-3">New Credential</h4>
          <div className="flex gap-2 mb-2">
            <select value={newField} onChange={(e) => setNewField(e.target.value)} className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-white text-sm">
              {CREDENTIAL_FIELDS.filter((f) => !existingFields.includes(f)).map((f) => (
                <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <input
            type="password" value={newValue} onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter value" className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white text-sm mb-2"
          />
          <div className="flex gap-2">
            <button onClick={handleAddNew} disabled={!newValue.trim()} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition">Save</button>
            <button onClick={() => { setShowAdd(false); setNewValue(''); }} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition">Cancel</button>
          </div>
        </div>
      )}

      {(!broker.credentials || broker.credentials.length === 0) && !showAdd && (
        <p className="text-sm text-gray-500 py-4 text-center">No credentials saved. Add your API key, client code, etc.</p>
      )}
    </div>
  );
};

export default CredentialForm;
