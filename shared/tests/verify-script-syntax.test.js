/**
 * Every `.js` file must actually BE JavaScript.
 *
 * `scripts/backfill-runner.js` was TypeScript source wearing a `.js` extension. Node parses
 * `.js` as plain JavaScript, so it died on `SyntaxError: Unexpected token '?'` the instant it
 * was forked — and every dashboard backfill silently failed for as long as that shipped.
 *
 * `no-ts-js-twins.test.js` did NOT catch it: that gate looks for a module existing as BOTH
 * `x.ts` and `x.js`. Here there was only the `.js`. This test closes that blind spot by
 * asking Node itself to parse every `.js` we ship.
 *
 * Run: node shared/tests/verify-script-syntax.test.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Executable JS we own. Layer source dirs + the scripts they fork.
const SCAN_DIRS = [
  'layer-1-ingestion/scripts',
  'layer-1-ingestion/src',
  'layer-2-processing/src',
  'layer-6-signal/src',
  'layer-7-core-interface/api/src',
  'layer-10-execution/src',
  'scripts',
  'shared',
];

const SKIP = /node_modules|[\\/]dist[\\/]|[\\/]\.next[\\/]|[\\/]manual[\\/]/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (SKIP.test(full)) continue;
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let pass = 0;
const failures = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    try {
      // Node's own parser is the authority — no regex heuristics.
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      pass++;
    } catch (err) {
      const msg = (err.stderr || Buffer.from('')).toString().split('\n').find((l) => /SyntaxError/.test(l)) || 'parse failed';
      failures.push({ file: path.relative(ROOT, file), msg: msg.trim() });
    }
  }
}

console.log(`\nscript-syntax: checked ${pass + failures.length} .js files`);

if (failures.length) {
  console.log('\n  FAIL — these .js files are not valid JavaScript:');
  for (const f of failures) {
    console.log(`    ✗ ${f.file}\n        ${f.msg}`);
  }
  console.log('\n  A .js file containing TypeScript will crash the moment Node loads it.');
  console.log('  Fix: rename it to .ts and run it under tsx (rule 15), or strip the TS syntax.\n');
  process.exit(1);
}

console.log(`  ok   all ${pass} .js files parse as JavaScript\n\nPASS`);
