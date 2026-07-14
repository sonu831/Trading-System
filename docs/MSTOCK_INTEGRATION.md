# MStock TypeB API — Integration Guide & Troubleshooting

> **Status:** ✅ Working (raw HTTP, no SDK dependency)
> **Auth:** Two-step TOTP flow → 1199-char trading JWT
> **Last updated:** 2026-07-14

---

## 1. Architecture

```
L7 BrokerSessionService (auth)
  └─ mstock.ts strategy (two-step flow)
       └─ mstock.adapter.ts (raw HTTP, no SDK)
            └─ MStock TypeB REST API (api.mstock.trade/openapi/typeb)

L1 Ingestion
  └─ CredentialStore (reads token from Redis, API key from L7)
       └─ MStockVendor (MTicker WebSocket for ticks)
```

**Key decision:** We use raw axios HTTP calls, NOT `@mstock-mirae-asset/nodetradingapi-typeb` SDK.
The SDK is installed but unused. All endpoints match the official docs at
https://tradingapi.mstock.com/docs/v1/typeB/

---

## 2. Authentication Flow

### Two-step TOTP (unattended, server-side)

```
Step 1: POST /openapi/typeb/connect/login
  Body: { clientcode, password, totp: "", state: "" }
  Headers: X-Mirae-Version: 1
  → Returns: { jwtToken: "UUID-request-token" }

Step 2: POST /openapi/typeb/session/verifytotp
  Body: { refreshToken: requestToken, totp: "6-digit-code" }
  Headers: X-Mirae-Version: 1, X-PrivateKey: api_key
  → Returns: { jwtToken: "1199-char-trading-JWT" }
```

### Why NOT the one-step flow?
The SDK docs show `client.login({ totp: "123456" })` as a single step. This produces
a **203-char session token** that works for WebSocket (MTicker) but MStock rejects it
for REST API calls with `401 Invalid request`.

**Always use two-step flow when `totp_secret` is configured.**

---

## 3. Token Storage

| Token Type | Size | Stored In | Used For |
|------------|------|-----------|----------|
| Request token (step 1) | ~36 chars (UUID) | Memory only | Never used beyond step 2 |
| Trading JWT (step 2) | 1199 chars | Redis: `broker:session:mstock` | All REST + WebSocket calls |
| Session token (one-step) | 203 chars | DO NOT STORE | WebSocket only, REST rejected |

---

## 4. Issues Encountered & Fixed

### #1: TOTP Secret is NOT a 6-digit code
**Symptom:** `totp_secret is not valid Base32 (A-Z, 2-7)`
**Root cause:** User entered `594601` (a generated OTP code) in the `totp_secret` field.
**Fix:** Added `normalizeBase32Secret()` validation that rejects non-Base32 values with
a descriptive error. The secret must come from `trade.mstock.com → Trading APIs → Enable TOTP`.

### #2: One-step login returns wrong token type
**Symptom:** `API Error: 401 Invalid request` on all REST calls
**Root cause:** `adapter.login({ totp: generatedCode })` returns a 203-char session token,
not the 1199-char trading JWT needed for REST.
**Fix:** Strategy now always uses two-step flow when `totp_secret` is set:
`login({ totp: '' })` → `verifyTOTP(requestToken, generatedCode)` → trading JWT.

### #3: API key from `getDecryptedCredentials` not applied to adapter
**Symptom:** REST calls return 401 even with valid token
**Root cause:** `getAdapter('mstock', apiKey)` did NOT recreate adapter if one already existed.
A stale adapter with wrong API key was reused.
**Fix:** `getAdapter()` now always recreates when `apiKey` is provided.

### #4: Quote response path mismatch
**Symptom:** `ltp: null` in index quote response
**Root cause:** Quote API returns `{ data: { fetched: [{ ltp: 24088 }] } }` but code read
`result.fetched[0]` instead of `result.data.fetched[0]`.
**Fix:** Added fallback: `result?.data?.fetched?.[0] || result?.fetched?.[0]`.

### #5: IP whitelist typo
**Symptom:** `Primary and Secondary IP Address are not matching`
**Root cause:** IP entered as `123.176.106.109` but actual IP is `122.176.106.109`.
**Fix:** Corrected IP on MStock portal.

### #6: Index tokens were `TODO_VERIFY_FROM_MSTOCK_UI`
**Symptom:** No NIFTY/BANKNIFTY data
**Root cause:** `vendor/nifty50_shared.json` had placeholder values for index MStock tokens.
**Fix:** Set NIFTY=26000, BANKNIFTY=26009, INDIAVIX=26017.

### #7: Historical API only returns completed days
**Symptom:** `0 candles` for today's date
**Root cause:** MStock historical endpoint returns data only for fully completed trading days.
**Fix:** Built CandleBuffer that polls LTP every 15s and builds OHLCV candles in real-time.
Stored in TimescaleDB (for analysis) + Redis (for dashboard).

### #8: WebSocket 502 from MStock
**Symptom:** MTicker WebSocket returns 502/503 repeatedly
**Root cause:** MStock demo/test accounts have rate-limited WebSocket.
**Fix:** Exponential backoff reconnection (5s → 10s → 15s → 20s → max 30s).
For production, REST polling (CandleBuffer) is the reliable fallback.

---

## 5. Adapter Endpoints

All calls use the adapter (`mstock.adapter.ts`) which uses raw axios:

| Method | MStock Endpoint | Our Route |
|--------|----------------|-----------|
| `login()` | POST /connect/login | Test Connection button |
| `verifyTOTP()` | POST /session/verifytotp | Auto (two-step flow) |
| `getPositions()` | GET /portfolio/positions | GET /api/v1/market/positions |
| `getHoldings()` | GET /portfolio/holdings | GET /api/v1/market/holdings |
| `getQuote()` | POST /instruments/quote | GET /api/v1/market/index?symbol=NIFTY |
| `getHistoricalData()` | POST /instruments/historical | GET /api/v1/market/index/NIFTY/candles |
| `getOptionChain()` | GET /GetOptionChain/{exch}/{expiry}/{token} | Not yet wired |

---

## 6. Dashboard Integration

| Component | Endpoint | Status |
|-----------|----------|--------|
| IndexTicker (header) | GET /api/v1/market/index/NIFTY/quote | ✅ Live, 3s poll |
| IndexTile (overview) | useIndexQuote hook | ✅ Clickable → /cockpit |
| MarketView (50 stocks) | GET /api/v1/market-view | ✅ One batch quote call |
| OptionChainGrid | GET /api/v1/options/chain | ⚠️ Empty DB, MStock fallback added |
| Candle chart | GET /api/v1/market/index/NIFTY/candles | ✅ CandleBuffer → Redis + TimescaleDB |
| TradingView widget | TV embedded widget | ❌ Free widget lacks NSE symbols |
| Positions | GET /api/v1/market/positions | ✅ Live |

---

## 7. Key Files

| File | Purpose |
|------|---------|
| `adapters/broker-adapter.interface.ts` | Contract for all broker adapters |
| `adapters/mstock.adapter.ts` | MStock raw HTTP wrapper (no SDK) |
| `adapters/index.ts` | Adapter registry (getAdapter, clearAdapter) |
| `strategies/mstock.ts` | Two-step TOTP auth flow strategy |
| `services/CandleBuffer.ts` | Polls LTP → builds candles → DB + Redis |
| `modules/system/routes.ts` | Index quotes, candles, option chain endpoints |
| `modules/market/MarketService.ts` | Market view (50 stocks + breadth) |
| `modules/broker/routes.ts` | Test connection, market data endpoints |
| `vendor/nifty50_shared.json` | Token map (symbol → MStock token) |

---

## 8. Quick Commands

```bash
# Test connection (two-step TOTP)
curl -X POST http://localhost:4000/api/v1/providers/mstock/test \
  -H "Content-Type: application/json" -H "x-api-key: <key>" -d '{}'

# NIFTY index quote
curl http://localhost:4000/api/v1/market/index/NIFTY/quote -H "x-api-key: <key>"

# Market view (all 50 stocks + indices)
curl http://localhost:4000/api/v1/market-view -H "x-api-key: <key>"

# Live candles (from CandleBuffer)
curl "http://localhost:4000/api/v1/market/index/NIFTY/candles?tf=1m&limit=10" -H "x-api-key: <key>"

# Positions
curl http://localhost:4000/api/v1/market/positions -H "x-api-key: <key>"
```
