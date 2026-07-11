// @ts-nocheck
import { useState } from 'react';

const BrokerAuthTest = ({ broker }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [totp, setTotp] = useState('');

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      if (broker.provider === 'mstock' && totp && /^\d{6}$/.test(totp)) {
        const res = await fetch(`/api/v1/providers/${broker.provider}/session/complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ totp }),
        });
        const data = await res.json();
        setResult(data);
      } else {
        const res = await fetch(`/api/v1/providers/${broker.provider}/test`, { method: 'POST' });
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {
      setResult({ success: false, error: 'Network error: ' + err.message });
    }
    setTesting(false);
  };

  return (
    <div className="card">
      <h3 className="text-sm font-bold mb-3">Connection Test</h3>
      <p className="text-xs text-text-tertiary mb-4">
        Enter your 6-digit TOTP from your authenticator app. Stored encrypted server-side.
      </p>

      {broker.provider === 'mstock' && (
        <div className="mb-4">
          <input
            type="text" maxLength={6} placeholder="TOTP code (e.g. 776395)"
            value={totp}
            onChange={(e) => /^\d{0,6}$/.test(e.target.value) && setTotp(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-surface border border-border text-text-primary text-lg tracking-[0.3em] text-center"
          />
        </div>
      )}

      <button onClick={handleTest} disabled={testing}
        className="btn-primary w-full justify-center text-sm mb-3">
        {testing ? 'Testing connection...' : 'Test Connection'}
      </button>

      {result && (
        <div className={`p-3 rounded-lg border text-xs ${result.success || result.data?.success ? 'bg-success/10 border-success/30 text-success' : 'bg-error/10 border-error/30 text-error'}`}>
          {result.success || result.data?.success ? (
            <div>
              <div className="font-semibold">Connected successfully</div>
              {(result.data?.token_info || result.data?.stage) && (
                <div className="mt-1 text-text-tertiary">Stage: {result.data?.stage || 'connected'} · Token: {result.data?.token_info?.length || 'N/A'}</div>
              )}
            </div>
          ) : (
            <div>
              <div className="font-semibold">Connection failed</div>
              <div className="mt-1">{result.error || result.data?.error || 'Unknown error'}</div>
              {result.data?.missing && <div className="mt-1">Missing: {result.data.missing.join(', ')}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrokerAuthTest;
