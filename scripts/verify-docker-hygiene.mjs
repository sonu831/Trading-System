#!/usr/bin/env node

/**
 * verify-docker-hygiene.mjs — CI gate that enforces Docker hygiene rules.
 *
 * Checks from LAYER_REMEDIATION_PLAN.md §11:
 *   I-1  Every build context has a .dockerignore
 *   I-2  .dockerignore includes `node_modules` (prevents host node_modules clobbering)
 *   I-3  No image runs as root (must have a USER directive)
 *   I-4  Every image has a HEALTHCHECK
 *   I-5  No `npm install --only=production` (use pnpm install --frozen-lockfile --prod)
 *
 * Usage:  node scripts/verify-docker-hygiene.mjs [--fix]
 *         --fix only reports; actual fixes must be manual.
 *
 * Exit 0 = clean.  Exit 1 = violations found.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Every directory that contains a Dockerfile is a "build context".
const buildContexts = findBuildContexts(ROOT);
let violations = 0;

console.log(`\n=== Docker Hygiene Audit — ${buildContexts.length} build contexts ===\n`);

for (const ctx of buildContexts) {
  const label = ctx.rel;
  const dockerfile = join(ctx.abs, 'Dockerfile');
  const dockerignore = join(ctx.abs, '.dockerignore');
  const content = readFileSync(dockerfile, 'utf8');

  // --- I-1: .dockerignore exists ---
  if (!existsSync(dockerignore)) {
    report(label, 'I-1', 'No .dockerignore');
    violations++;
  }

  // --- I-2: node_modules in .dockerignore (only for Node images) ---
  if (existsSync(dockerignore) && isNodeImage(content)) {
    const ignoreContent = readFileSync(dockerignore, 'utf8');
    if (!/^node_modules$/m.test(ignoreContent)) {
      report(label, 'I-2', '.dockerignore missing node_modules entry');
      violations++;
    }
  }

  // --- I-3: Non-root USER ---
  if (!hasUserDirective(content)) {
    report(label, 'I-3', 'No USER directive — image runs as root');
    violations++;
  }

  // --- I-4: HEALTHCHECK ---
  if (!hasHealthcheck(content)) {
    report(label, 'I-4', 'No HEALTHCHECK');
    violations++;
  }

  // --- I-5: npm install --only=production ---
  if (content.includes('npm install --only=production')) {
    report(label, 'I-5', 'Uses deprecated npm install --only=production (use npm ci --omit=dev)');
    violations++;
  }

  // --- I-6: .dockerignore must exclude .env* (rule 6: no secrets in image layers) ---
  if (existsSync(dockerignore)) {
    const ignoreContent = readFileSync(dockerignore, 'utf8');
    if (!/^\.env(\*|\.\*)?$/m.test(ignoreContent)) {
      report(label, 'I-6', '.dockerignore does not exclude .env* — secrets could be baked into a layer');
      violations++;
    }
  }

  // --- I-7: TLS verification must NEVER be disabled at runtime ---
  // This shipped once. `ENV NODE_TLS_REJECT_UNAUTHORIZED=0` makes the process accept ANY
  // certificate, so a man-in-the-middle can read and alter broker credentials and orders.
  // A build-stage `npm config set strict-ssl false` is tolerated (corporate proxy).
  if (/^\s*ENV\s+NODE_TLS_REJECT_UNAUTHORIZED\s*=?\s*0/mi.test(content)) {
    report(label, 'I-7', 'Sets NODE_TLS_REJECT_UNAUTHORIZED=0 — disables TLS verification for broker traffic');
    violations++;
  }
}

// --- Cross-check: no /PiConnectTP references in any source file ---
console.log('\n--- Cross-cutting: FlatTrade URL audit ---\n');
const flattradeFiles = findFilesContaining(ROOT, 'PiConnectTP', ['.git', 'node_modules', '__pycache__', '.next', 'dist']);
for (const f of flattradeFiles) {
  // The remediation plan itself, verification scripts, files that document
  // the old buggy URL in comments (not active code), and markdown docs are allowed.
  if (f.includes('LAYER_REMEDIATION_PLAN.md')) continue;
  if (f.includes('verify-docker-hygiene')) continue;
  if (f.includes('verify-flattrade-urls')) continue;
  if (f.includes('BROKER_LOGIN_FLOWS.md')) continue;
  if (f.endsWith('.md')) continue; // all markdown docs are documentation, not code

  const content = readFileSync(resolve(ROOT, f), 'utf8');
  if (!hasActiveBadUrl(content, 'PiConnectTP')) {
    console.log(`  OK    ${f.padEnd(45)} (PiConnectTP in prose only — documenting the fix)`);
    continue;
  }
  report(f, 'X-URL', 'Contains the invalid URL segment /PiConnectTP in a string literal');
  violations++;
}

console.log(`\n${'='.repeat(50)}`);
if (violations > 0) {
  console.log(`VIOLATIONS: ${violations}`);
  console.log(`See docs/LAYER_REMEDIATION_PLAN.md §11 for fix instructions.`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(1);
} else {
  console.log(`CLEAN — all ${buildContexts.length} contexts pass hygiene checks.`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(0);
}

// ── helpers ──

function report(label, rule, message) {
  console.log(`  ${rule}  ${label.padEnd(45)} ${message}`);
}

/**
 * Extract the contents of real STRING LITERALS, ignoring comments.
 *
 * Two traps this must survive — both were hit while writing this gate:
 *
 *  1. You cannot strip comments by cutting at the first `//`: every URL contains `//`
 *     (`https://…`), so that truncates real URLs and HIDES genuine violations.
 *  2. You cannot match quotes with a regex alone: a markdown backtick inside a JSDoc
 *     block (`` `/PiConnectTP` ``) looks exactly like a template literal, so prose gets
 *     misreported as code.
 *
 * So: one pass, tracking whether we are inside a string or a comment. A quote only opens
 * a string from `normal`; a `//` only opens a comment from `normal`.
 */
function extractStringLiterals(src) {
  const out = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    // comments (only start outside a string)
    if (c === '/' && next === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && next === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; } // python/sh

    // string literals
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i++;
      let buf = '';
      while (i < n) {
        if (src[i] === '\\') { buf += src[i + 1] ?? ''; i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        buf += src[i++];
      }
      out.push(buf);
      continue;
    }

    i++;
  }
  return out;
}

/**
 * Does `needle` appear inside live code (a string literal) rather than prose?
 *
 *   FLATTRADE: 'https://x/PiConnectAPI', // NOT /PiConnectTP   -> prose  (allowed)
 *   //   1. URL was `.../PiConnectTP/REST/…`                    -> prose  (allowed)
 *   this.baseUrl = 'https://x/PiConnectTP/REST/GetQuotes';      -> code   (violation)
 */
function hasActiveBadUrl(content, needle) {
  return extractStringLiterals(content).some((lit) => lit.includes(needle));
}

function isNodeImage(content) {
  return content.includes('FROM node:') || content.includes('FROM nodejs');
}

function hasUserDirective(content) {
  return /^USER\s+\S+/m.test(content);
}

function hasHealthcheck(content) {
  return /^HEALTHCHECK/m.test(content);
}

function findBuildContexts(root) {
  const results = [];
  function walk(dir) {
    if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('.next')) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.name === 'Dockerfile') {
        results.push({ abs: dir, rel: full.replace(root, '').replace(/\\/g, '/').replace(/^\//, '') });
      } else if (e.isDirectory()) {
        walk(full);
      }
    }
  }
  walk(root);
  return results;
}

function findFilesContaining(root, pattern, skipDirs) {
  const results = [];
  function walk(dir) {
    try {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (skipDirs.some((d) => e.name === d)) continue;
          walk(join(dir, e.name));
        } else if (e.isFile()) {
          const full = join(dir, e.name);
          try {
            const content = readFileSync(full, 'utf8');
            if (content.includes(pattern)) {
              results.push(full.replace(root, '').replace(/\\/g, '/').replace(/^\//, ''));
            }
          } catch {}
        }
      }
    } catch {}
  }
  walk(root);
  return results;
}
