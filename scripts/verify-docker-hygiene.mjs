#!/usr/bin/env node

/**
 * verify-docker-hygiene.mjs — CI gate that enforces Docker hygiene rules.
 *
 * Checks from LAYER_REMEDIATION_PLAN.md §11:
 *   I-1  Every build context has a .dockerignore
 *   I-2  .dockerignore includes `node_modules` (prevents host node_modules clobbering)
 *   I-3  No image runs as root (must have a USER directive)
 *   I-4  Every image has a HEALTHCHECK
 *   I-5  No `npm install --only=production` (use npm ci --omit=dev)
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
  // Check if the reference is only in comments/documentation (not active code)
  const content = readFileSync(resolve(ROOT, f), 'utf8');
  const activeLines = content.split('\n')
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith('//') && !t.startsWith('#') && !t.startsWith('*') && !t.startsWith('/*');
    });
  const inActiveCode = activeLines.some((l) => l.includes('PiConnectTP'));
  if (!inActiveCode) {
    console.log(`  OK    ${f.padEnd(45)} (PiConnectTP in comments only — documenting the fix)`);
    continue;
  }
  report(f, 'X-URL', 'Contains the invalid URL segment /PiConnectTP in active code');
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
