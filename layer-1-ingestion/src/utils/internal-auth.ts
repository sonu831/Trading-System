/**
 * Internal auth for L1 → L7 calls.
 *
 * Layer 7 is default-deny: every call to it must carry the service key. The long-running L1
 * process gets this via the global axios interceptor — but **forked child scripts do not**.
 * `backfill-runner.ts` runs in its own process and never executes `src/index.ts`, so it has no
 * interceptor; without this helper every backend call it makes comes back 401 and the backfill
 * dies at "discovering providers".
 *
 * Scoped to the backend host ON PURPOSE: attaching the key as a blanket axios default would
 * ship our internal service key to every broker API this process talks to (MStock, FlatTrade).
 */

/* eslint-disable @typescript-eslint/no-var-requires */
let SHARED: any = null;
try { SHARED = require('/app/shared/constants'); } catch (_) {
  try { SHARED = require('../../../shared/constants'); } catch (_e) { SHARED = null; }
}
if (!SHARED?.API_KEY_HEADER) {
  throw new Error('shared/constants.js API_KEY_HEADER not resolvable — L1 cannot authenticate to L7');
}

const API_KEY_HEADER: string = SHARED.API_KEY_HEADER;
const BACKEND_API_URL: string = process.env.BACKEND_API_URL || 'http://backend-api:4000';

/** True only for calls to our own L7 gateway — never for broker APIs. */
function isBackendUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith(BACKEND_API_URL) || url.startsWith('/api/');
}

/** Attach the service key to backend-bound requests on the given axios instance. */
function attachInternalAuth(axiosInstance: any): void {
  axiosInstance.interceptors.request.use((config: any) => {
    const key = process.env.INTERNAL_API_KEY || '';
    if (isBackendUrl(config.url) && key) {
      config.headers = config.headers || {};
      config.headers[API_KEY_HEADER] = key;
    }
    return config;
  });
}

module.exports = { attachInternalAuth, isBackendUrl, API_KEY_HEADER, BACKEND_API_URL };
