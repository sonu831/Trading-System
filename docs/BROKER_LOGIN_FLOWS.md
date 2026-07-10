# Broker Login Flows

> Each broker provider has a different authentication mechanism. This doc describes each flow and which credentials are required.

---

## MStock (Type B TOTP)

**Auth type:** TOTP-based login  
**API base:** `https://api.mstock.trade`  
**SDK:** `@mstock-mirae-asset/nodetradingapi-typeb`

### Required credentials
| Field | Description | Example |
|-------|-------------|---------|
| `api_key` | Generated at trade.mstock.com → Trading APIs | `G1c8FKZye50R6d4sRd868Q==` |
| `client_code` | Your MStock login ID | `MA31803` |
| `password` | Your MStock password | `Sonu831$` |

### Optional
| Field | Description |
|-------|-------------|
| `access_token` | Pre-generated JWT (skip login if provided) |

### Login flow (TWO-STEP — ALWAYS required)

```
Step 1: POST /connect/login { clientcode, password, totp: "", state: "" }
        → returns data.jwtToken = short-lived REQUEST token (a UUID, NOT the trading token)

Step 2: POST /session/verifytotp
        Headers: { X-PrivateKey: api_key }
        Body:    { refreshToken: <request token from step 1>, totp: <6-digit TOTP code> }
        → returns data.jwtToken = the REAL trading token (Authorization: Bearer <this>)
```

**Important trap:** Login returns `"Login Success"` + `is_activate: true` even with TOTP enabled — but that token is just a UUID, not the trading token. Step 2 is **always** required. Enabling TOTP only suppresses the OTP SMS/email, it does NOT skip step 2.

### Token lifecycle
- JWT valid until 12:00 AM of the generated day
- Refresh before expiry for continuous access
- TOTP secret stored server-side, generator uses SHA1/6-digit/30s

### Important notes
- **Never expose `api_key` in client-side code or mobile apps**
- TOTP codes are generated server-side (secret stored encrypted in DB)
- **Step 1 returns a REQUEST token (UUID), Step 2 returns the REAL trading token (JWT)**
- Caching the step-1 token as the session token makes every later API call 401

---

## FlatTrade

**Auth type:** API Key  
**API base:** `https://piconnect.flattrade.in/PiConnectTP`  
**Format:** jKey (API key) + jData (JSON payload)

### Required credentials
| Field | Description |
|-------|-------------|
| `api_key` | Your FlatTrade API key |
| `client_code` | Your FlatTrade user ID |

### Optional
| Field | Description |
|-------|-------------|
| `password` | Account password (not typically needed for API) |
| `access_token` | Pre-generated token |

### Login flow
```
POST https://piconnect.flattrade.in/PiConnectTP/UserDetails
Params: { jKey: api_key, jData: '{"uid":"user_id"}' }
```

Returns user details if valid. **No separate login step** — the API key is used as the credential for all subsequent calls.

### API call pattern
All FlatTrade API calls use the same pattern:
```
POST https://piconnect.flattrade.in/PiConnectTP/<Endpoint>
Params: {
  jKey: api_key,
  jData: JSON.stringify({ uid: user_id, ...otherParams })
}
```

### Supported operations
- `placeOrder`, `modifyOrder`, `cancelOrder`
- `getOrderBook`, `getPositions`, `getQuote`
- Order types: MKT, LMT, SL-MKT, SL-LMT
- Products: NRML (delivery), INTRADAY
- Exchange: NFO (options), NSE (equity)

---

## Zerodha Kite

**Auth type:** OAuth 2.0 / Access Token  
**API base:** `https://api.kite.trade`

### Required credentials
| Field | Description |
|-------|-------------|
| `api_key` | Kite Connect API key |
| `access_token` | Pre-generated access token from Kite Connect login |

### Login flow (Kite Connect — done once in browser)
1. User redirects to Zerodha Kite Connect login URL
2. User authenticates with Zerodha credentials
3. Zerodha redirects back with `request_token`
4. Server exchanges `request_token` for `access_token`:
```
POST https://api.kite.trade/session/token
Params: { api_key, request_token, checksum }
```
5. `access_token` is stored and used for all API calls

### API call pattern
```
GET/POST https://api.kite.trade/<endpoint>
Headers: {
  Authorization: "token api_key:access_token",
  X-Kite-Version: "3"
}
```

### Supported operations
- Real-time WebSocket ticks (KiteTicker)
- Historical data
- Order placement/modification/cancellation
- Portfolio/position queries

### Token lifecycle
- Access token valid for one trading day
- Must re-authenticate daily via Kite Connect

---

## IndianAPI

**Auth type:** None (free API)  
**Rate limit:** Throttled per IP

### Login flow
No authentication required. Used for development/testing with simulated data.

---

## Credential Storage

All broker credentials are stored **encrypted** in the `broker_credentials` table (TimescaleDB):

| Column | Purpose |
|--------|---------|
| `provider_id` | FK to `broker_providers` |
| `field_name` | `api_key`, `client_code`, `password`, `totp_secret`, `access_token` |
| `ciphertext` | AES-256-GCM encrypted value (base64) |
| `iv`, `tag` | Encryption parameters |

### Security rules
- **Never stored in plaintext** — all values encrypted with AES-256-GCM
- **Master key** in `CREDENTIAL_MASTER_KEY` env var (32-byte hex)
- **TOTP stays server-side** — generated from stored secret, never exposed
- **Masked in API responses** — `G1c***Q==`
- **Test before save** — login handshake verified before credential accepted

---

## Session Token Cache

After successful authentication, the session token is cached in Redis:

```
Key: broker:session:{provider}
Value: { token: "jwt...", expiresAt: timestamp }
TTL: Matches token expiry
```

Both L1 (ingestion) and L10 (execution) read this token to avoid duplicate logins.
