# Broker Credential Management & MStock UI Integration Plan

> **Status:** plan | **Agents:** ingestion-specialist, api-gateway-engineer, presentation-specialist, storage-engineer

## Current State

MStock credentials are **hardcoded environment variables** in `.env`:

```
MSTOCK_API_KEY=xxx
MSTOCK_CLIENT_CODE=xxx
MSTOCK_PASSWORD=xxx
MSTOCK_TOTP_SECRET=xxx
MSTOCK_ACCESS_TOKEN=xxx
```

This means to change broker, you must:
1. Edit `.env`
2. Restart ingestion service

**No UI exists** to manage credentials. **No DB table** stores them.

## Goal

Allow users to add/update MStock credentials from the dashboard UI, with the ingestion service picking up changes without restart.

---

## Architecture Plan

### Step 1: Add `broker_credentials` Prisma Model

```prisma
model broker_credentials {
  id          Int      @id @default(autoincrement())
  broker      String   // "mstock", "kite", "flattrade"
  field_name  String   // "api_key", "client_code", "password", "totp_secret", "access_token"
  field_value String   // encrypted
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@unique([broker, field_name])
}
```

### Step 2: Layer 7 API Endpoints (Credential Management)

```
POST   /api/v1/broker/credentials      -- Save credential (encrypted at rest)
GET    /api/v1/broker/credentials      -- List configured brokers (values masked)
PUT    /api/v1/broker/credentials/:id  -- Update credential
DELETE /api/v1/broker/credentials/:id  -- Remove credential
POST   /api/v1/broker/mstock/test      -- Test MStock login with current creds
POST   /api/v1/broker/restart          -- Signal ingestion to reload creds
```

### Step 3: Encryption

Credentials stored encrypted in DB using `crypto.createCipheriv` (AES-256-GCM) with a server-side encryption key from env var `CREDENTIAL_ENCRYPTION_KEY`. Never expose raw values via API.

### Step 4: Ingestion Credential Hot-Reload

Add a Redis pub/sub channel for credential changes:

```
Layer 7 (API)
  |
  |-- Saves credential to DB (encrypted)
  |-- Publishes: Redis PUBLISH broker:reload:mstock "{}"
  |
  v
Layer 1 (Ingestion)
  |-- Subscribes: Redis SUBSCRIBE broker:reload:*
  |-- On message: reads DB, updates in-memory credential store
  |-- Reconnects broker if active
```

The `VendorManager` already has a pattern for this -- extend with a `reloadCredentials(broker)` method.

### Step 5: Dashboard UI

Add a "Broker Settings" page at `/settings/broker`:

```
┌──────────────────────────────────────┐
│ Broker Configuration               │
│                                      │
│ Provider: [MStock ▼]                │
│                                      │
│ API Key:     [••••••••••••••••]     │
│ Client Code: [••••••••••••••••]     │
│ Password:    [••••••••••••••••]     │
│ TOTP Secret: [••••••••••••••••]     │
│                                      │
│ [Test Connection]  [Save]           │
│                                      │
│ Status: ● Connected (last: 2m ago)  │
└──────────────────────────────────────┘
```

### Step 6: Credential Priority

```
1. In-memory (from Redis/dashboard input)  ← HOT RELOAD
2. Environment variables (.env)            ← FALLBACK
3. Database (encrypted at rest)            ← PERSISTED SOURCE
```

The ingestion `MStockVendor.authenticate()` already checks `this.accessToken` first (if pre-provided). Extend this to read from the credential store before falling back to env vars.

---

## MStock Adapter Pattern (Already Exists -- Documenting for Reference)

The system already uses a clean **Strategy Pattern** for broker adapters:

```
VendorFactory.createVendor(provider) → VendorManager → BaseVendor
                                                          ├── KiteVendor
                                                          ├── MStockVendor
                                                          ├── FlatTradeVendor
                                                          ├── IndianApiVendor
                                                          └── CompositeVendor
```

### MStockVendor Flow:

```
Constructor
├── Reads env vars (MSTOCK_API_KEY, etc.)
├── Creates MConnect HTTP client
└── Creates MTicker WebSocket client

authenticate()
├── Path A: Pre-provided ACCESS_TOKEN → set token, skip login
└── Path B: Full 2-step auth
    ├── Step 1: client.login({clientcode, password}) → temp JWT
    ├── Step 2: OTPAuth.TOTP.generate(secret) → 6-digit code
    └── Step 3: client.verifyTOTP(tempToken, code) → final JWT

connect()
├── authenticate() if not already
├── Start WebSocket (MTicker)
└── Subscribe to watchlist symbols

fetchData(params)     ← BaseVendor smart router
├── Market open → live WebSocket ticks
├── Market closed → recent history
└── Date range → historical API (with 401 auto-recovery)
```

### What needs to change for UI credential management:

1. `MStockVendor` constructor → reads from `CredentialStore` (new) before env vars
2. `CredentialStore` → loads from DB on startup, subscribes to Redis reload events
3. `VendorManager` → adds `reloadCredentials(broker)` method
4. Layer 7 → new credential CRUD endpoints
5. Layer 8 → broker settings page

---

## Layer Interaction Diagram (With Credential Flow)

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard (L8)                                          │
│  /settings/broker → POST /api/v1/broker/credentials    │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────────────────┐
│ API Gateway (L7)                                        │
│  Validates → Encrypts → Saves to DB                   │
│  Publishes: REDIS PUBLISH broker:reload:mstock         │
└──────┬──────────────────────────────┬───────────────────┘
       │ TimescaleDB Write             │ Redis Pub
┌──────▼──────────┐          ┌────────▼───────────────────┐
│ Storage (L3)     │          │ Ingestion (L1)             │
│ broker_creds     │          │ SUBSCRIBE broker:reload:* │
│ table            │          │ CredentialStore.reload()  │
└──────────────────┘          │ MStockVendor.reset()      │
                              └────────────────────────────┘
```

---

## Implementation Order

| # | Task | Agent | Est. |
|---|------|-------|------|
| 1 | Add `broker_credentials` Prisma model + migration | storage-engineer | 30m |
| 2 | Add credential CRUD endpoints (L7) | api-gateway-engineer | 1h |
| 3 | Add encryption/decryption middleware | api-gateway-engineer | 30m |
| 4 | Add CredentialStore to ingestion (L1) | ingestion-specialist | 1h |
| 5 | Add Redis pub/sub for hot-reload | ingestion-specialist | 30m |
| 6 | Add broker settings UI page (L8) | presentation-specialist | 1h |
| 7 | Add `make db-reset` safety for credentials | devops-engineer | 15m |

**Total:** ~4.5 hours

---

## Security Notes

- Credentials encrypted at rest (AES-256-GCM)
- API endpoint requires authentication (admin-level)
- Masked values in GET responses (`MST***KEY`)
- Never logged (strip from error messages)
- `CREDENTIAL_ENCRYPTION_KEY` in env, never committed
