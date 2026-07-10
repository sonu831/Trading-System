import { useState } from 'react';

const MStockAuthFlow = ({ broker }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/providers/mstock/test', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: 'Network error: ' + err.message });
    }
    setTesting(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Connection Test</h3>
      <p className="text-sm text-gray-400 mb-4">
        Tests the full login + TOTP handshake using your saved credentials (api_key, client_code, password, totp_secret). All stored encrypted server-side.
      </p>

      <button
        onClick={handleTest}
        disabled={testing}
        className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 mb-3"
      >
        {testing ? 'Testing connection...' : 'Test Connection'}
      </button>

      {result && (
        <div className={`p-3 rounded border text-sm ${
          result.success || result.data?.success
            ? 'bg-green-900/30 border-green-700 text-green-300'
            : 'bg-red-900/30 border-red-700 text-red-300'
        }`}>
          {result.success || result.data?.success ? (
            <div>
              <div className="font-medium">Connected successfully</div>
              {(result.data?.token_info || result.data?.stage) && (
                <div className="text-xs mt-1">
                  Stage: {result.data?.stage || 'connected'} · Token: {result.data?.token_info?.length || 'N/A'}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="font-medium">Connection failed</div>
              <div className="text-xs mt-1">{result.error || result.data?.error || 'Unknown error'}</div>
              {result.data?.missing && (
                <div className="text-xs mt-1">
                  Missing: {result.data.missing.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MStockAuthFlow;
