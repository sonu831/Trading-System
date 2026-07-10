// @ts-nocheck
import { useState } from 'react';

const FIELD_LABELS = {
  api_key: 'API Key', client_code: 'Client Code', password: 'Password',
  totp_secret: 'TOTP Secret', access_token: 'Access Token',
  refresh_token: 'Refresh Token', feed_token: 'Feed Token',
};

const CredentialField = ({ fieldName, value, isActive, onSave, onRemove }) => {
  const [show, setShow] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editValue.trim()) return;
    setSaving(true);
    await onSave(fieldName, editValue);
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-b-0">
      <div className="w-32 flex-shrink-0">
        <span className="text-sm font-medium text-gray-300">{FIELD_LABELS[fieldName] || fieldName}</span>
        {isActive && <span className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block" />}
      </div>
      <div className="flex-1 relative">
        <input
          type={show ? 'text' : 'password'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder={value ? 'Change value (leave empty to keep)' : `Enter ${FIELD_LABELS[fieldName] || fieldName}`}
          className="w-full p-2 pr-10 rounded bg-gray-700 border border-gray-600 text-white text-sm placeholder-gray-500"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs">
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <button onClick={handleSave} disabled={saving || !editValue.trim()} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition disabled:opacity-50 flex-shrink-0">
        {saving ? '...' : 'Save'}
      </button>
    </div>
  );
};

export default CredentialField;
