// ── Broker Auth Logger — single source of truth for auth-trace logging ────
// Import this from any layer to get consistent auth-flow logs.
// Usage: const { authLog } = require('/app/shared/auth-logger');
//        authLog.mstock('login', 'STEP', { client_code: 'MA31803' });

const VERBOSE = process.env.AUTH_LOG_VERBOSE !== 'false'; // default ON

const COLORS = {
  START: '\x1b[34m',   // blue
  STEP:  '\x1b[36m',   // cyan
  OK:    '\x1b[32m',   // green
  FAIL:  '\x1b[31m',   // red
  WARN:  '\x1b[33m',   // yellow
  DATA:  '\x1b[35m',   // magenta
  RESET: '\x1b[0m',
};

function ts() { return new Date().toISOString(); }

function fmt(level, provider, phase, message, data) {
  const color = COLORS[level] || COLORS.RESET;
  const tag = `[auth:${provider}]`.padEnd(16);
  const phaseTag = `[${phase}]`.padEnd(10);
  let line = `${color}${tag} ${phaseTag} ${message}${COLORS.RESET}`;
  if (data !== undefined) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    if (payload.length > 200) line += ' ' + payload.slice(0, 200) + '...(truncated)';
    else line += ' ' + payload;
  }
  return line;
}

const authLog = {
  mstock: {
    start(msg, data)   { if (VERBOSE) console.log(fmt('START', 'mstock', 'START', msg, data)); },
    step(msg, data)    { if (VERBOSE) console.log(fmt('STEP',  'mstock', 'STEP', msg, data)); },
    ok(msg, data)      { if (VERBOSE) console.log(fmt('OK',    'mstock', 'OK', msg, data)); },
    fail(msg, data)    { console.error(fmt('FAIL', 'mstock', 'FAIL', msg, data)); },
    warn(msg, data)    { console.warn(fmt('WARN', 'mstock', 'WARN', msg, data)); },
    data(msg, data)    { if (VERBOSE) console.log(fmt('DATA',  'mstock', 'DATA', msg, data)); },
  },
  flattrade: {
    start(msg, data)   { if (VERBOSE) console.log(fmt('START', 'flattrade', 'START', msg, data)); },
    step(msg, data)    { if (VERBOSE) console.log(fmt('STEP',  'flattrade', 'STEP', msg, data)); },
    ok(msg, data)      { if (VERBOSE) console.log(fmt('OK',    'flattrade', 'OK', msg, data)); },
    fail(msg, data)    { console.error(fmt('FAIL', 'flattrade', 'FAIL', msg, data)); },
    warn(msg, data)    { console.warn(fmt('WARN', 'flattrade', 'WARN', msg, data)); },
    data(msg, data)    { if (VERBOSE) console.log(fmt('DATA',  'flattrade', 'DATA', msg, data)); },
  },
  kite: {
    start(msg, data)   { if (VERBOSE) console.log(fmt('START', 'kite', 'START', msg, data)); },
    step(msg, data)    { if (VERBOSE) console.log(fmt('STEP',  'kite', 'STEP', msg, data)); },
    ok(msg, data)      { if (VERBOSE) console.log(fmt('OK',    'kite', 'OK', msg, data)); },
    fail(msg, data)    { console.error(fmt('FAIL', 'kite', 'FAIL', msg, data)); },
    warn(msg, data)    { console.warn(fmt('WARN', 'kite', 'WARN', msg, data)); },
    data(msg, data)    { if (VERBOSE) console.log(fmt('DATA',  'kite', 'DATA', msg, data)); },
  },
};

module.exports = { authLog };
