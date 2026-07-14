// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';

/**
 * Broker connection panel.
 *
 * The TOTP block exists because enrolling TOTP on the broker's portal requires you to prove you
 * hold the secret by submitting a live code — and without a way to produce one here, that code
 * got pasted into the `totp_secret` field. A code dies in 30 seconds, so unattended auth could
 * never work and every broker call came back 401. Store the SECRET; let the server derive codes.
 */
const BrokerAuthTest = ({ broker }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [totp, setTotp] = useState('');
  const [jwt, setJwt] = useState(null);
  const [jwtLoading, setJwtLoading] = useState(false);

  // Server-derived TOTP (from the stored secret) — never the secret itself.
  const [gen, setGen] = useState(null); // { code, expiresIn } | { error }
  const [copied, setCopied] = useState(false);

  const isMStock = broker.provider === 'mstock';

  const fetchGeneratedTotp = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/providers/${broker.provider}/totp`);
      const data = await res.json();
      if (data.success) setGen({ code: data.data.code, expiresIn: data.data.expiresIn });
      else setGen({ error: data.error || 'No TOTP secret stored' });
    } catch (e) {
      setGen({ error: 'Could not reach the API' });
    }
  }, [broker.provider]);

  // Refresh when the 30s window rolls over, so the displayed code is always the live one.
  useEffect(() => {
    if (!isMStock) return;
    fetchGeneratedTotp();
    const t = setInterval(() => {
      setGen((g) => {
        if (!g || g.error) return g;
        if (g.expiresIn <= 1) {
          fetchGeneratedTotp();
          return g;
        }
        return { ...g, expiresIn: g.expiresIn - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isMStock, fetchGeneratedTotp]);

  const fetchJwt = async () => {
    setJwtLoading(true);
    try {
      const res = await fetch(`/api/v1/providers/${broker.provider}/session/info`);
      const data = await res.json();
      if (data?.data?.jwt) setJwt(data.data.jwt);
    } catch (_) {}
    setJwtLoading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    setJwt(null);
    try {
      // With the secret stored, the server generates its own code — no manual entry needed.
      // The manual field stays only as a fallback for accounts without TOTP enrolled.
      const useManual = isMStock && /^\d{6}$/.test(totp);
      const url = useManual
        ? `/api/v1/providers/${broker.provider}/session/complete`
        : `/api/v1/providers/${broker.provider}/test`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useManual ? { totp } : {}),
      });
      const data = await res.json();
      setResult(data);
      if (data.success || data?.data?.success) fetchJwt();
    } catch (err) {
      setResult({ success: false, error: 'Network error: ' + err.message });
    }
    setTesting(false);
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ok = result && (result.success || result.data?.success);

  return (
    <div className="card">
      <h3 className="text-sm font-bold mb-3">Connection Test</h3>

      {isMStock && (
        <div className="mb-4 rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold">Current TOTP</h4>
            <span className="text-[10px] text-text-tertiary">
              from the stored secret — server-generated
            </span>
          </div>

          {gen?.error ? (
            <div className="text-xs text-warning">
              {gen.error}
              <div className="mt-1 text-text-tertiary">
                Save the Base32 <b>secret</b> (or the full <code>otpauth://</code> URI) in the{' '}
                <b>totp_secret</b> field above — not a 6-digit code. A code expires in 30s and can
                never be reused.
              </div>
            </div>
          ) : gen ? (
            <div className="flex items-center gap-3">
              <span className="tabular-nums font-mono text-2xl font-extrabold tracking-[0.25em] text-primary">
                {gen.code}
              </span>
              <button
                onClick={() => copy(gen.code)}
                className="rounded bg-primary/15 px-2 py-1 text-[10px] text-primary transition hover:bg-primary/25"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <span className="ml-auto text-[11px] text-text-tertiary">
                rotates in {gen.expiresIn}s
              </span>
            </div>
          ) : (
            <div className="animate-pulse text-xs text-text-tertiary">Generating…</div>
          )}

          <div className="mt-2 text-[11px] text-text-tertiary">
            Use this to enable TOTP at <b>trade.mstock.com → Products → Trading APIs → Enable
            TOTP</b>. Once enrolled, connection is automatic — you never type a code again.
          </div>
        </div>
      )}

      {isMStock && (
        <div className="mb-4">
          <input
            type="text"
            maxLength={6}
            placeholder="Manual code (only if TOTP is not enrolled)"
            value={totp}
            onChange={(e) => /^\d{0,6}$/.test(e.target.value) && setTotp(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface p-2.5 text-center text-lg tracking-[0.3em] text-text-primary"
          />
        </div>
      )}

      <button
        onClick={handleTest}
        disabled={testing}
        className="btn-primary mb-3 w-full justify-center text-sm"
      >
        {testing ? 'Testing connection…' : 'Test Connection'}
      </button>

      {result && (
        <div
          className={`rounded-lg border p-3 text-xs ${ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'}`}
        >
          {ok ? (
            <div>
              <div className="font-semibold">Connected successfully</div>
              <div className="mt-1 text-text-tertiary">
                Stage: {result.data?.stage || 'connected'}
                {result.data?.auth_type ? ` · ${result.data.auth_type}` : ''}
              </div>
            </div>
          ) : (
            <div>
              <div className="font-semibold">Connection failed</div>
              <div className="mt-1">{result.error || result.data?.error || 'Unknown error'}</div>
              {result.data?.missing && (
                <div className="mt-1">Missing: {result.data.missing.join(', ')}</div>
              )}
              {result.data?.likelyCauses && (
                <ul className="mt-1 list-disc pl-4 text-text-tertiary">
                  {result.data.likelyCauses.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {jwtLoading && (
        <div className="mt-4 animate-pulse text-xs text-text-tertiary">Fetching session…</div>
      )}

      {jwt && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-text-primary">
              Session token ({jwt.length} chars)
            </h4>
            <button
              onClick={() => copy(jwt)}
              className="rounded bg-primary/15 px-2 py-1 text-[10px] text-primary transition hover:bg-primary/25"
            >
              Copy
            </button>
          </div>
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-background p-3 font-mono text-[10px] text-success">
            {jwt}
          </pre>
        </div>
      )}
    </div>
  );
};

export default BrokerAuthTest;
