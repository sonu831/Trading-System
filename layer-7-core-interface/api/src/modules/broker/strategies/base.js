/**
 * Broker auth strategy — the contract every provider implements.
 *
 * Brokers differ in ways that cannot be papered over, so the contract makes the
 * differences explicit instead of assuming MStock's shape:
 *
 *   - Some are UNATTENDED (a stored secret is enough: MStock+TOTP, FlatTrade, IndianAPI).
 *   - Some are INTERACTIVE: a value arrives out-of-band and a human must supply it
 *     (MStock OTP by SMS/email; Kite's `request_token` from a browser redirect).
 *     These need a two-phase begin -> needs_input -> complete flow.
 *   - Token lifetimes differ (MStock dies at IST midnight; Kite ~06:00 IST; an
 *     API-key "token" never expires).
 *
 * A strategy is a plain object:
 *
 *   {
 *     id, label,
 *     requiredFields: string[],        // must be present before we even try
 *     optionalFields: string[],        // e.g. totp_secret, api_secret
 *     interactiveInputs: string[],     // inputs `complete()` may be called with
 *     capabilities: { data, execution, restingStop, orderStatus },
 *     ttlSeconds(now): number,         // broker-specific session lifetime
 *     authenticate(creds, deps, ctx): Promise<Result>
 *   }
 *
 * `ctx` is `{ input?, pending? }`:
 *   - first call (begin):    ctx = {}
 *   - completing a flow:     ctx = { input: {otp|request_token}, pending: {...} }
 *
 * `deps` is `{ http, generateTOTP, sha256, now }` — injected so every strategy is
 * testable without network access or vendor SDKs.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const TTL_SAFETY_MARGIN_S = 120;

/** Wall-clock IST as a Date whose UTC fields read as IST. */
function istView(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

/** Seconds until the next IST midnight (MStock: "token valid till 12:00 AM of generated day"). */
function secondsUntilISTMidnight(now = new Date()) {
  return secondsUntilNextISTHour(0, now);
}

/**
 * Seconds until the next occurrence of `hour`:00 IST.
 * Kite invalidates sessions in the early morning; MStock at midnight.
 */
function secondsUntilNextISTHour(hour, now = new Date()) {
  const ist = istView(now);
  let target = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hour, 0, 0, 0);
  if (target <= ist.getTime()) {
    target = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, hour, 0, 0, 0);
  }
  const seconds = Math.floor((target - ist.getTime()) / 1000) - TTL_SAFETY_MARGIN_S;
  return Math.max(60, seconds);
}

/**
 * Brokers are wildly inconsistent about success flags:
 *   MStock   -> status: true | "true"
 *   Kite     -> status: "success"
 *   FlatTrade Pi      -> stat: "Ok"
 *   FlatTrade authapi -> status: "Ok"
 */
const isOk = (r) =>
  r?.status === true || r?.status === 'true' || r?.status === 'success' || r?.status === 'Ok' || r?.stat === 'Ok';

const errorOf = (r, fallback) =>
  r?.message || r?.emsg || r?.data?.message || r?.errorcode || r?.error_type || fallback;

// ── Result constructors (the only three shapes a strategy may return) ──
const connected = ({ token, ttlSeconds, meta = {} }) => ({
  success: true,
  status: 'connected',
  stage: 'connected',
  token, // consumed by the service; never returned to the client
  ttlSeconds,
  ...meta,
});

const needsInput = ({ inputType, pending = {}, message, ttlSeconds = 300 }) => ({
  success: false,
  status: 'needs_input',
  stage: `needs_${inputType}`,
  inputType,
  pending,
  pendingTtlSeconds: ttlSeconds,
  error: message,
});

const failure = ({ stage, error, ...rest }) => ({
  success: false,
  status: 'error',
  stage,
  error,
  ...rest,
});

module.exports = {
  IST_OFFSET_MS,
  TTL_SAFETY_MARGIN_S,
  istView,
  secondsUntilISTMidnight,
  secondsUntilNextISTHour,
  isOk,
  errorOf,
  connected,
  needsInput,
  failure,
};
