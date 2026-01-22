import React, { useState } from 'react';

const MStockDashboard = () => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [requestToken, setRequestToken] = useState(''); // OTP
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Login to get OTP (Triggered by backend usually, but here simulating flow)
  // In MStock Type A, Login API sends OTP to mobile.
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/mstock/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.status === 'success') {
        setStep(2); // Move to OTP
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and Get Token
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/mstock/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, request_token: requestToken }),
      });

      const data = await res.json();
      if (data.status === 'success') {
        setAccessToken(data.data.access_token);
        setStep(3); // Success
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-white max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4 border-b border-gray-600 pb-2">MStock Integration</h2>

      {error && <div className="bg-red-500 text-white p-2 rounded mb-4">{error}</div>}

      {step === 1 && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-200"
          >
            {loading ? 'Logging in...' : 'Login & Get OTP'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="bg-blue-900 p-3 rounded text-sm mb-4">✅ OTP Sent to your mobile!</div>
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 text-white"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="From MStock Portal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">OTP (Request Token)</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 text-white"
              value={requestToken}
              onChange={(e) => setRequestToken(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-200"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-green-800 p-4 rounded text-center">
            <h3 className="text-xl font-bold">🎉 Authenticated!</h3>
            <p className="text-sm mt-2">Access Token Generated</p>
          </div>

          <div className="bg-gray-900 p-3 rounded break-all font-mono text-xs border border-gray-700">
            {accessToken}
          </div>

          <p className="text-gray-400 text-sm">
            Copy this token and add it to your <code>.env</code> file or secrets manager as{' '}
            <code>MSTOCK_ACCESS_TOKEN</code>.
            <br />
            (Future: This will be auto-saved to backend)
          </p>

          <button
            onClick={() => setStep(1)}
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
};

export default MStockDashboard;
