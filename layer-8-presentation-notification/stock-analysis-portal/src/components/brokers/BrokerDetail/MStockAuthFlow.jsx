import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveCredential, selectAuthFlow, setAuthFlowStep, setAuthFlowData, resetAuthFlow } from '@/store/slices/brokerSlice';

const MSTOCK_TYPEB_LOGIN = 'https://api.mstock.trade/openapi/typeb/connect/login';
const MSTOCK_TYPEB_TOKEN = 'https://api.mstock.trade/openapi/typeb/session/token';

const MStockAuthFlow = ({ broker, apiKey }) => {
  const dispatch = useDispatch();
  const authFlow = useSelector(selectAuthFlow);
  const [clientCode, setClientCode] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const step1Login = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(MSTOCK_TYPEB_LOGIN, {
        method: 'POST', headers: { 'X-Mirae-Version': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientcode: clientCode, password, totp: '', state: '' }),
      });
      const data = await res.json();
      if (data.status === 'true') {
        dispatch(setAuthFlowData({ step: 'otp', refreshToken: data.data.jwtToken }));
      } else {
        setError(data.message || 'Login failed');
      }
    } catch { setError('Network error connecting to mStock'); }
    finally { setLoading(false); }
  };

  const step2VerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(MSTOCK_TYPEB_TOKEN, {
        method: 'POST', headers: { 'X-Mirae-Version': '1', 'Content-Type': 'application/json', 'X-PrivateKey': apiKey || '' },
        body: JSON.stringify({ refreshToken: authFlow.refreshToken, otp }),
      });
      const data = await res.json();
      if (data.status === 'true' && data.data?.jwtToken) {
        await dispatch(saveCredential({ providerId: broker.id, field_name: 'access_token', field_value: data.data.jwtToken }));
        if (data.data.refreshToken) {
          await dispatch(saveCredential({ providerId: broker.id, field_name: 'refresh_token', field_value: data.data.refreshToken }));
        }
        if (data.data.feedToken) {
          await dispatch(saveCredential({ providerId: broker.id, field_name: 'feed_token', field_value: data.data.feedToken }));
        }
        dispatch(setAuthFlowData({ step: 'done', jwtToken: data.data.jwtToken, refreshToken: data.data.refreshToken, feedToken: data.data.feedToken }));
      } else {
        setError(data.message || 'OTP verification failed');
      }
    } catch { setError('Network error verifying OTP'); }
    finally { setLoading(false); }
  };

  if (authFlow.step === 'done') {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-green-400">mStock TOTP Auth</h3>
          <button onClick={() => dispatch(resetAuthFlow())} className="text-xs text-gray-400 hover:text-white underline">Reset</button>
        </div>
        <div className="bg-green-900/30 border border-green-700 rounded p-3 text-sm text-green-300 mb-3">
          Authentication successful! Tokens saved to encrypted storage.
        </div>
        {authFlow.feedToken && <div className="text-xs text-gray-400">Feed token saved for WebSocket streaming</div>}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">mStock TOTP Authentication</h3>

      {error && <div className="bg-red-900/30 border border-red-700 rounded p-2 text-sm text-red-300 mb-3">{error}</div>}

      {authFlow.step === 'otp' ? (
        <form onSubmit={step2VerifyOtp} className="space-y-3">
          <div className="bg-blue-900/30 border border-blue-700 rounded p-2 text-sm text-blue-300">
            Enter the TOTP from your authenticator app
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">TOTP Code</label>
            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" maxLength={6} className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white text-center text-lg tracking-widest" required />
          </div>
          <button type="submit" disabled={loading || otp.length < 4} className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition disabled:opacity-50">
            {loading ? 'Verifying...' : 'Verify TOTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={step1Login} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Client Code</label>
            <input type="text" value={clientCode} onChange={(e) => setClientCode(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white" required />
          </div>
          <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition disabled:opacity-50">
            {loading ? 'Connecting...' : 'Login & Send OTP'}
          </button>
        </form>
      )}
    </div>
  );
};

export default MStockAuthFlow;
