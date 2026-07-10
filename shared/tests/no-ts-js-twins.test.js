/**
 * Repo-wide gate: no module may exist as BOTH `x.ts` and `x.js`.
 *
 * Why this exists. The .js->.ts migration renamed files without deleting the originals, so
 * several modules had two divergent implementations of the same name:
 *
 *   - shared/constants.{ts,js}           — the .js held 2 of 17 exports; `KAFKA_TOPICS` was
 *                                          undefined at runtime, so a consumer subscribed to
 *                                          a topic literally named "undefined".
 *   - layer-1-ingestion/.../ist-time.{ts,js} — the .js hardcoded weekly expiry weekday 4
 *                                          while shared/constants.js declares 2. The P0 fix
 *                                          lived in the .ts; Node loaded the .js.
 *
 * Node's CommonJS resolver prefers `.js`; tsc and tsx prefer `.ts`. So the type-checker
 * validates one file and production runs the other. Nothing fails loudly. This does.
 *
 * Run: node shared/tests/no-ts-js-twins.test.js
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  'graphify-out', 'vendor', '.pnpm',
]);

/** Compiled output legitimately sits beside source in a few generated trees. */
const SKIP_PATH_FRAGMENTS = ['/dist/', '/build/', '/.next/', '/generated/'];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

const twins = [];
for (const tsFile of walk(REPO_ROOT)) {
  const posix = tsFile.split(path.sep).join('/');
  if (SKIP_PATH_FRAGMENTS.some((frag) => posix.includes(frag))) continue;

  const jsTwin = tsFile.slice(0, -3) + '.js';
  if (fs.existsSync(jsTwin)) {
    twins.push(path.relative(REPO_ROOT, tsFile).split(path.sep).join('/').slice(0, -3));
  }
}

if (twins.length === 0) {
  console.log('no-ts-js-twins: PASS — no module exists as both .ts and .js');
  process.exit(0);
}

console.error('no-ts-js-twins: FAIL — these modules exist as BOTH .ts and .js.');
console.error('Node loads the .js; tsc/tsx check the .ts. Delete whichever is dead.\n');
for (const t of twins) console.error(`  ${t}.ts  <->  ${t}.js`);
console.error(`\n${twins.length} twin(s).`);
process.exit(1);
