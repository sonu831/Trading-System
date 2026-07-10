# TypeScript Migration Plan — Entire Project

> **Goal:** move the Node estate to **strict TypeScript**, and use the migration to force the decoupling we
> already decided on: ports & adapters, one-way dependencies, and `shared/` as a real package.
> **Status:** PLAN | **Audited:** 2026-07-10 (file counts + grep evidence, not estimates)
>
> Standards: [`.ai/skills/engineering-standards.md`](../.ai/skills/engineering-standards.md) · rules 11–14.
> Related: [`RESTRUCTURE_PLAN.md`](RESTRUCTURE_PLAN.md) · [`DASHBOARD_ENHANCEMENT_PLAN.md`](DASHBOARD_ENHANCEMENT_PLAN.md)

---

## 0. TL;DR

1. **Do not start by renaming files.** Three measured blockers (§3) make that fail on the first build.
2. **`shared/` becomes a real workspace package** `@trading/shared`. The **8** `require('/app/shared/…')`
   absolute container imports must die — `tsc` cannot resolve them and they only work inside Docker.
3. **Migrate `layer-10-execution` first** among services: it is the money path *and* the only layer with a real
   test suite (91 assertions), so the migration is **provable**, not hopeful.
4. **Branded types are the point**, not the syntax. `Premium` ≠ `SpotPrice` would have made this month's worst
   bug a compile error.
5. **Three things never migrate:** Go (L4/L5), Python (L1-flattrade, L9), and **`layer-1-tradingview`**
   (ESM + upstream git subtree, 58 files).

---

## 1. Why TypeScript (grounded in bugs that shipped)

| Problem that shipped | The type that prevents it |
|---|---|
| `entryPrice` = index spot compared against option premium → instant "stop-loss" on every position | `Premium` vs `SpotPrice` branded types — **uncompilable** |
| P&L omitted `lotSize` → risk understated **75×** | `pnl(entry: Premium, exit: Premium, lots: Lots, lotSize: LotSize)` |
| `\|\| 0` coerced absent P&L to a confident `₹0` | `strictNullChecks` + `Loaded<T>` union |
| Execution port `8090` vs `8095` in four files | `PORTS.EXECUTION` — one constant |
| Kafka topic string literals across layers | `KAFKA_TOPICS.TRADE_SIGNALS` |
| Expiry weekday: `2` (Tue) in L10, `4` (Thu) in L1 — two numbering schemes | `IsoWeekday = 1\|…\|7` rejects `0` and `9` |
| `catch (err) { err.message }` swallowing broker failures | `useUnknownInCatchVariables` |
| Organisms `fetch` directly → untestable | `ExecutionPort` interface — swap a fake |

---

## 2. Audit — measured, not estimated

### 2.1 Source counts (excl. `node_modules`, `.next`, `dist`, `graphify-out`)

| Layer | .js | .jsx | .ts | .tsx | .go | .py | Migrate? |
|-------|----:|-----:|----:|-----:|----:|----:|---|
| `shared` | 10 | 0 | 3 | 0 | 2 | 0 | ✅ **first** |
| `layer-1-ingestion` | 43 | 0 | 6 | 0 | 0 | 0 | ✅ |
| `layer-1-flattrade-python` | 0 | 0 | 0 | 0 | 0 | 2 | ❌ Python |
| `layer-1-tradingview` | 58 | 0 | 0 | 0 | 0 | 0 | ❌ **subtree + ESM** |
| `layer-2-processing` | 10 | 0 | 0 | 0 | 0 | 0 | ✅ |
| `layer-3-storage` | 0 | 0 | 0 | 0 | 0 | 0 | — (SQL only) |
| `layer-4-analysis` | 0 | 0 | 0 | 0 | 10 | 0 | ❌ Go |
| `layer-5-aggregation` | 0 | 0 | 0 | 0 | 7 | 0 | ❌ Go |
| `layer-6-signal` | 15 | 0 | 1 | 0 | 0 | 0 | ✅ |
| `layer-7-core-interface` | 57 | 0 | 3 | 0 | 0 | 0 | ✅ |
| `layer-8-presentation-notification` | 78 | 62 | 9 | 5 | 0 | 0 | ✅ (largest) |
| `layer-9-ai-service` | 0 | 0 | 0 | 0 | 0 | 9 | ❌ Python |
| `layer-10-execution` | 17 | 0 | 3 | 0 | 0 | 0 | ✅ **first service** |
| `scripts` | 13 | 0 | 0 | 0 | 0 | 5 | ✅ (js only) |

**In scope: ~243 `.js` + 62 `.jsx` ≈ 305 files.** Already TS: ~30 (≈ 9 %).
**Out of scope: 58 js** (tradingview subtree) **+ 17 Go + 16 Python.**

> The previous draft of this plan undercounted (L1 34 vs **43**, L10 13 vs **17**, L8 "40+" vs **140**) and did
> not exclude the tradingview subtree at all.

### 2.2 What already exists — build on it
- 8 `tsconfig.json` (root, `shared`, L1, L2, L6, L7-api, L10, portal). Root is already `strict: true`,
  `allowJs: true`, `noEmit: true`, `include: ["shared/**/*.ts"]`.
- `shared/` is TS-first: `index.ts`, `ports.ts`, `types.ts`, and a `tsconfig` emitting `dist/` with `declaration`.
- `typescript` already a dep in `layer-1-ingestion`, `layer-7-core-interface/api`, portal.
- `shared/constants.js` already holds `KAFKA_TOPICS`, `REDIS_KEYS`, `PORTS`, `BROKER_BASE_URLS`, `EXPIRY_WEEKDAY_ISO`.

---

## 3. The blockers — fix before renaming a single file

### B1 · `require('/app/shared/…')` — absolute container paths (**8 sites**)

```
layer-1-ingestion/src/index.js:40         layer-7-core-interface/api/src/index.js:50, :229
layer-2-processing/src/index.js:6         layer-8-…/email-service/src/index.js:159
layer-2-processing/src/kafka/consumer.js:5
layer-6-signal/src/index.js:8             shared/constants.js:8 (doc comment)
```

These resolve **only inside Docker** (compose mounts `../../shared → /app/shared`). `tsc` cannot type them;
`node`, `tsx` and jest cannot run them locally. It is exactly why the local suites had to use
`require('../../shared/constants')` instead.

**Fix:** `@trading/shared` workspace package, imported **by name**.

> ⚠️ **Do not** solve this with `tsconfig.paths` alone (the previous draft proposed `"@shared/*"`).
> `paths` is a *type-resolution* feature. At CommonJS runtime `node` will still throw
> `Cannot find module '@shared/types'` unless you add `tsconfig-paths`, bundle, or use real workspaces.
> Use workspaces.

### B2 · `shared/` is mounted **read-only at runtime**, not built

If `shared` is TypeScript, containers must receive **compiled JS + `.d.ts`**. A read-only mount of `.ts` source
cannot be `require()`d by a plain Node process.

**Fix:** `shared` builds to `shared/dist`; `COPY` the built package into images (see §7) and drop the mount.

### B3 · Per-layer Docker build contexts

Every service builds with `context: ../../layer-N-…`, so **a workspace package outside that directory cannot be
`COPY`d**. This is precisely why `layer-10-execution` could not import `shared` at all — it had no mount until
today, and re-declared broker URLs, ports and the expiry weekday locally. They drifted.

**Fix:** move build context to the repo root with per-service Dockerfiles (§7).

### B4 · `layer-1-tradingview` — `"type": "module"` **and** a git subtree

Upstream: `sonu831/trading-view-bot`. Migrating it conflicts on every `git subtree pull`.
**Permanently excluded** unless upstream migrates.

### B5 · `shared/constants.go` is a hand-maintained duplicate — already drifted

`constants.js` = 200 lines; `constants.go` = **66**. The Go copy has `8095` but **none of the broker base URLs**.
A second language cannot be kept in sync by discipline. **Generate it** (§6).

### B6 · Tests are plain node scripts

`verify-*.js` — **240 passing assertions** (L1 32 · L7 117 · L10 91). They are the safety net and must keep
running throughout. Add `tsx` so a `.ts` test runs unchanged.

---

## 4. Target shape — modular, decoupled, reusable

### 4.1 npm workspaces

```jsonc
// package.json (root)
{ "workspaces": [
    "shared", "packages/*",
    "layer-1-ingestion", "layer-2-processing", "layer-6-signal",
    "layer-7-core-interface/api", "layer-10-execution",
    "layer-8-presentation-notification/*"
] }
```

### 4.2 Extract the duplication the audit found

Four modules exist in **multiple copies**. They are the first packages, and each copy has already produced a real
defect:

| Duplicated today | Copies | Becomes | Defect it caused |
|---|---|---|---|
| FlatTrade/Noren wire helpers (base URL, `jData&jKey`, `stat:'Ok'`, status normalisation) | `layer-1-ingestion/src/utils/flattrade.js`, `layer-7-…/broker/strategies/flattrade.js`, `layer-10-execution/src/oms/flattrade.js` | `@trading/noren` | L1 kept `/PiConnectTP/REST/` long after L7/L10 were fixed |
| IST time helpers | `layer-1-ingestion/src/utils/ist-time.js`, `layer-10-execution/src/utils/time.js`, `layer-7-…/strategies/base.js` | `@trading/time` | expiry weekday Tue (L10) vs Thu (L1) |
| TOTP + Base32 normalisation | `layer-1-ingestion/src/vendors/mstock.js`, `layer-7-…/BrokerSessionService.js` | `@trading/broker-auth` | silent UTF-8 fallback → wrong TOTP |
| `utils/logger.js` | 5 copies | `@trading/logger` | inconsistent secret redaction |

### 4.3 Inside a service — one-way dependencies

```
domain/    pure types + rules. Imports NOTHING.        (PositionMath, RiskRules, RegimeState)
ports/     interfaces the app needs.                   (BrokerAdapter, QuoteFeed, Journal, Clock)
app/       use-cases. Depends on ports + domain.        No axios. No redis. No fs.
adapters/  implements ports.                            (FlatTradeAdapter, RedisJournal, AxiosHttp)
infra/     wiring, config, entrypoint.
```

`adapters → ports ← app → domain`. **Enforced, not suggested:**

```jsonc
// .eslintrc — import/no-restricted-paths
{ "zones": [
  { "target": "./src/domain", "from": "./src/(app|adapters|infra|ports)" },
  { "target": "./src/app",    "from": "./src/(adapters|infra)" },
  { "target": "./src/ports",  "from": "./src/(app|adapters|infra)" }
]}
```

---

## 5. Strictness ratchet — one flag per PR

`strict: true` is already on. These are the flags that catch **our** bug classes.

| Flag | Catches | Our real bug |
|------|---------|--------------|
| `strictNullChecks` *(in `strict`)* | unknown ≠ zero | `₹0 P&L` rendered confidently |
| `useUnknownInCatchVariables` *(in `strict`)* | `catch (err) { err.message }` | poller swallowed 100 % failure to `debug` |
| `noUncheckedIndexedAccess` | `rows[0]` may be `undefined` | empty `SingleOrdHist` array |
| `exactOptionalPropertyTypes` | `{ttl?: number}` vs `ttl: undefined` | `redis.set(k,v,{EX: undefined})` |
| `noImplicitOverride` | silent method shadowing | `BaseOMS` subclass drift |
| `noPropertyAccessFromIndexSignature` | typo'd config keys | `config.mstock.endpoints.*` |
| `verbatimModuleSyntax` *(last)* | CJS/ESM confusion | tradingview `type: module` |

**Rule:** a flag goes repo-wide only when `tsc --noEmit` is clean with it. Never `@ts-ignore`; use
`@ts-expect-error` **with a reason**, so it fails loudly once the underlying issue is fixed.

---

## 6. Branded domain types — the actual payoff

```ts
// shared/src/domain/money.ts
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type Rupees     = Brand<number, 'INR'>;
export type Premium    = Brand<number, 'OPTION_PREMIUM'>;  // per-unit option price
export type SpotPrice  = Brand<number, 'INDEX_SPOT'>;      // index level
export type Lots       = Brand<number, 'LOTS'>;
export type LotSize    = Brand<number, 'LOT_SIZE'>;
export type IsoWeekday = 1|2|3|4|5|6|7;

export type OptionType = 'CE' | 'PE';
export type TradeMode  = 'paper' | 'shadow' | 'live';

/** E6: sign-neutral to direction — we are always long premium. */
export const pnl = (entry: Premium, exit: Premium, lots: Lots, lotSize: LotSize): Rupees =>
  ((exit - entry) * lots * lotSize) as Rupees;

/** Rule 13: unknown is not zero. */
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'unreachable'; reason: string }
  | { status: 'stale'; value: T; ageSeconds: number }
  | { status: 'fresh'; value: T };
```

Three shipped bugs become **uncompilable**: `pnl(spot, …)` (E5), a missing `lotSize` (E6), and
`expiryWeekday = 0 | 9`.

---

## 7. Go & Python: generate, don't hand-copy

```
shared/spec/constants.yaml   ← the ONE source
   ├─ codegen → shared/src/constants.ts   (+ dist/constants.js + .d.ts)
   ├─ codegen → shared/constants.go       (L4, L5)
   └─ codegen → shared/constants.py       (L1-flattrade, L9)
```

CI gate: regenerate, then `git diff --exit-code`. Drift fails the build, not production.
Kafka/HTTP payload contracts: keep generating TS types from L7's Fastify JSON schemas
(`json-schema-to-typescript`) into `@trading/shared`.

---

## 8. Build & Docker (lands the outstanding infra fixes too)

```yaml
# docker-compose.app.yml
execution:
  build:
    context: ../..                        # repo root, so workspaces resolve
    dockerfile: layer-10-execution/Dockerfile
```

```dockerfile
# layer-10-execution/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /repo
COPY package*.json ./
COPY shared/package.json shared/
COPY layer-10-execution/package.json layer-10-execution/
RUN npm ci --omit=dev --workspaces --include-workspace-root   # reproducible; lockfiles exist
COPY shared shared
COPY layer-10-execution layer-10-execution
RUN npm run build -w shared && npm run build -w layer-10-execution

FROM node:20-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /repo/layer-10-execution/dist ./dist
COPY --from=builder --chown=app:app /repo/node_modules ./node_modules
USER app
HEALTHCHECK --interval=30s CMD node -e "require('http').get('http://localhost:8095/health',r=>process.exit(r.statusCode===200?0:1))"
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/index.js"]
```

This simultaneously fixes: multi-stage · `npm ci` · **non-root** · `tini` · healthcheck.

> A root `.dockerignore` becomes **mandatory** (`node_modules`, `.git`, `.env*`, `dist`, `.next`, `coverage`).
> Today `layer-10-execution` and `stock-analysis-portal` have host `node_modules` in their build context with no
> `.dockerignore` — `COPY . .` would ship **Windows-built native modules into a Linux image**.

---

## 9. Conversion pattern

```js
// BEFORE — layer-10-execution/src/oms/mstock.js
async getQuote(symbol) {
  const res = await this.post(this.endpoints.quote, { symbol });
  return { ltp: parseFloat(res.lastPrice || 0) };   // ❌ absent price becomes a confident 0
}
```

```ts
// AFTER — layer-10-execution/src/adapters/mstock.ts
import type { Quote, Premium } from '@trading/shared';

async getQuote(symbol: string): Promise<Quote | null> {
  const res = await this.post(this.endpoints.quote, { symbol });
  if (res?.lastPrice == null) return null;          // ✅ fail closed (rule 11/13)
  return { ltp: parseFloat(res.lastPrice) as Premium };
}
```

---

## 10. Phased plan — each phase independently shippable

| Phase | Scope | Files | Acceptance |
|---|---|---:|---|
| **P0** Foundation | workspaces · `tsconfig.base.json` · ESLint boundary zones · `tsx` · root `.dockerignore` · **Docker context move** · CI gates | **0 renamed** | `tsc --noEmit` green; **240 assertions unchanged**; every image builds |
| **P1** `@trading/shared` | `shared/*.js → .ts`; kill all 8 `/app/shared` imports; constants codegen (ts/go/py) | 10 | Go/Py constants regenerate identically; L1/L2/L6/L7 boot |
| **P2** `layer-10-execution` | domain/ports/adapters split; branded `Premium`/`Rupees` | 17 | **91 assertions pass**; `pnl(spot,…)` fails to compile |
| **P3** extract packages | `@trading/noren`, `@trading/time`, `@trading/broker-auth`, `@trading/logger` | — | L1/L7/L10 share one copy; 152 assertions pass |
| **P4** `layer-7-core-interface/api` | modules → ports/adapters; types from Fastify schemas | 57 | 117 assertions pass |
| **P5** `layer-6-signal` | **write tests first**, then migrate | 15 | new regime/router suite green |
| **P6** `layer-2` + `layer-1-ingestion` | CandleAggregator tests first | 53 | tick→candle suite green |
| **P7** `layer-8` dashboard | Atomic leaf-first: atoms → molecules → organisms → pages | 140 | `next build` green; light theme fixed |
| **P8** `scripts` | backtest/validation | 13 | suites pass |
| **Never** | `layer-1-tradingview`, Go, Python | 91 | — |

**Ratchet after each phase** — forbid new `.js` under migrated paths:

```bash
git diff --name-only origin/main... | grep -E '^(shared|layer-10-execution)/.*\.js$' && exit 1 || true
```

### Why this order
- **`shared` first** — everything imports it; B1/B2/B3 all originate there.
- **L10 second** — the only service with a real suite, so conversion is *verifiable*; branded types pay off
  immediately on the money path.
- **L6 late, tests first** — converting an untested brain to TS produces confident-looking code that has still
  never run (rule 12).
- **Dashboard last** — 140 files, lowest blast radius, and it wants stable `@trading/shared` types first.

---

## 11. CI gates

| Gate | Command | Scope |
|---|---|---|
| Type check | `tsc --noEmit` | every migrated path |
| Boundaries | `eslint . --max-warnings=0` (`import/no-restricted-paths`) | Node layers |
| No new `.js` | ratchet script above | migrated paths |
| Behaviour | `npm run verify` (240 assertions) | L1, L7, L10 |
| Constants drift | codegen + `git diff --exit-code` | `shared/` → go/py |
| Docker hygiene | `.dockerignore` present · non-root · `npm ci` | all images |
| Go / Python | `golangci-lint run` · `ruff check .` | L4/L5 · L9/L1-py |
| Graph | `graphify update .` | all |

---

## 12. Risks & non-goals

| Risk | Mitigation |
|---|---|
| Big-bang rename stalls the repo | Leaf-first, per-phase, `allowJs: true` throughout |
| `tsconfig.paths` "works" in the IDE, throws at runtime | Use **workspaces**, not `paths`, for runtime resolution |
| tradingview subtree conflicts | Permanently excluded |
| `ts-node` runtime hack in `layer-7-…/src/index.js:4` (registered for the MStock SDK) | Remove in P4 once the SDK is wrapped by `@trading/broker-auth` |
| Docker context change breaks builds | Ship it in **P0**, before any rename; verify each image |
| Go/Python constant drift | codegen + `git diff --exit-code` |
| **Types create false confidence** | Types prove compilation, never behaviour. The 240 assertions remain the gate (rule 12). |

**Non-goals:** rewriting Go/Python; repo-wide ESM; changing Fastify/Next.

---

## 13. Decision Record

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-10 | `shared` → `@trading/shared` workspace package; delete all `/app/shared` absolute imports | `tsc` cannot resolve them; they exist only inside Docker |
| 2026-07-10 | Use workspaces, **not** `tsconfig.paths`, for runtime module resolution | `paths` is type-only; CJS `node` still throws |
| 2026-07-10 | Docker build context moves to repo root | Per-layer contexts cannot `COPY` a workspace package — this is why L10 had no `shared` at all |
| 2026-07-10 | `layer-10-execution` migrates before any other service | Only layer with a real test suite → provable migration |
| 2026-07-10 | Branded `Premium`/`SpotPrice`/`Rupees`/`IsoWeekday` | Makes E5, E6 and the expiry-weekday bug uncompilable |
| 2026-07-10 | `constants.{go,py}` are **generated**, never hand-written | `constants.go` already drifted (66 vs 200 lines, no broker URLs) |
| 2026-07-10 | `layer-1-tradingview` permanently excluded | ESM + upstream git subtree |
| 2026-07-10 | Untested layers get tests **before** migration | TS proves compilation, not behaviour |

---

## 14. Hand-off

- **Next:** **P0** — root `tsconfig.base.json`, npm workspaces, ESLint boundary zones, `tsx`, root
  `.dockerignore`, and the Docker context move. **Zero files renamed in P0.**
- **Owner decision:** confirm the Docker build-context move (repo root vs `npm pack` per context). Everything
  downstream depends on it.
- **Blocked:** P5/P6 require tests first — `layer-6-signal` and `layer-2-processing` have **zero**.
- **Not pushed:** no git operations performed.
