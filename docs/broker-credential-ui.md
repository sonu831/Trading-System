# Broker Credential UI — mStock Type B Implementation Plan

## Overview

Build a UI to manage mStock Type B broker credentials with the existing DB-encrypted backend API. Supports TOTP-based auth flow, credential CRUD, and auto-login from the dashboard.

## Backend API (Already Built)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/providers` | List all providers (masked secrets) |
| `POST` | `/api/v1/providers` | Create new provider entry |
| `GET` | `/api/v1/providers/:id` | Get provider + decrypted creds |
| `PATCH` | `/api/v1/providers/:id` | Update provider config |
| `POST` | `/api/v1/providers/:id/enable` | Enable provider |
| `POST` | `/api/v1/providers/:id/disable` | Disable provider |
| `POST` | `/api/v1/providers/:id/credentials` | Save encrypted credential |
| `GET` | `/api/v1/providers/:provider/status` | Get live provider status |

## Frontend Pages

### 1. Broker List Page (`/brokers`)
- Overview table of all brokers (enabled/disabled status)
- Quick enable/disable toggle
- Status indicator (connected/disconnected/error)
- "Add Broker" button

### 2. Broker Detail Page (`/brokers/:id`)
- Provider config (name, role, priority)
- Credential form with masked fields + show/hide toggle
- One-click "Test Connection"
- Auto-login TOTP flow:
  - Step 1: Login (clientcode + password) → triggers OTP
  - Step 2: Enter TOTP → generates jwtToken
  - Step 3: Auto-saves access_token + refresh_token + feedToken
- Connection status log
- Delete/disconnect actions

### 3. Add Broker Modal/Drawer
- Select broker type (dropdown: mstock, flattrade, kite, indianapi)
- Set role (data/execution/both)
- Set priority
- Create → redirects to detail page

## Components

```
src/
  components/
    brokers/
      BrokerList/
        BrokerList.jsx          # Main list page
        BrokerCard.jsx          # Individual broker card
        BrokerStatusBadge.jsx   # Status indicator
      BrokerDetail/
        BrokerDetail.jsx        # Detail page wrapper
        BrokerConfig.jsx        # Config form (role, priority)
        CredentialForm.jsx      # Add/edit credential fields
        CredentialField.jsx     # Single masked credential input
        ConnectionTest.jsx      # Test connection button + result
        MStockAuthFlow.jsx      # TOTP auth flow (Step 1-3)
      AddBrokerModal.jsx        # Create new broker modal
  pages/
    brokers/
      index.js                  # Broker list page
      [id].js                   # Broker detail page
  store/
    slices/
      brokerSlice.js            # Redux slice for broker state
```

## Data Flow

```
User fills credential form
  → POST /api/v1/providers/:id/credentials { field_name, field_value }
    → Backend encrypts with AES-256-GCM
      → Saves to broker_credentials table

User clicks "Test Connection"
  → Broker fetches decrypted creds
    → Calls mStock Type B API login
      → Returns status + token
        → Updates broker_providers.status + broker_sessions

User completes TOTP flow
  → Step 1: POST https://api.mstock.trade/openapi/typeb/connect/login
    → Returns jwtToken + refreshToken
  → Step 2: POST https://api.mstock.trade/openapi/typeb/session/token
    → Sends OTP + refreshToken → returns jwtToken + feedToken
  → Auto-saves tokens to encrypted credentials
```

## Redux State

```js
{
  brokers: {
    list: [],
    selected: null,
    loading: false,
    error: null,
    authFlow: {
      step: null,      // null | 'login' | 'otp' | 'done'
      jwtToken: null,
      refreshToken: null,
      feedToken: null,
    }
  }
}
```

## Implementation Order

1. Redux slice (`brokerSlice.js`)
2. Broker list page (`/brokers`)
3. Add Broker modal
4. Broker detail page with config form
5. Credential form with show/hide masking
6. mStock Type B TOTP auth flow
7. Connection test button
8. Add navigation link to /brokers route
