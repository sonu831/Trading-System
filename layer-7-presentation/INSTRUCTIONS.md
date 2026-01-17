# Layer 7: Presentation Instructions

## Overview
This layer handles the user interface and external API. It consists of a Next.js Dashboard, a Fastify REST API, a Socket.io Server, and a Telegram Bot.

## Components

### 1. Dashboard (Next.js)
- **Path**: `layer-7-presentation/dashboard`
- **Standards**:
  - Use Functional Components with Hooks.
  - Use `TailwindCSS` for styling.
  - Use `SWR` or `React Query` for data fetching.
  - No direct database access; fetch data via REST API or WebSocket.

### 2. REST API (Fastify)
- **Path**: `layer-7-presentation/api`
- **Standards**:
  - Use Schemas for request/response validation.
  - Follow RESTful conventions (`GET /api/v1/signals`, `GET /api/v1/candles`).

### 3. Telegram Bot (Telegraf)
- **Path**: `layer-7-presentation/telegram-bot`
- **Standards**:
  - Handle rate limiting diligently to avoid bans by Telegram.
  - Use formatting (Markdown/HTML) to make alerts readable.

## Development Guidelines

### Code Formatting
- **Frontend**: Use Prettier with standard Next.js config.
- **Backend API**: Follow standard Node.js style guide.

### WebSocket Integration
- **Socket.io**: Used for real-time frontend updates. 
- **Events**:
  - `tick`: Latest price updates.
  - `signal`: New trading signals.

### Security
- **Authentication**: All API endpoints (except public readonly) must be protected.
- **Input Validation**: Sanitize all inputs to prevent XSS/Injection.

## Project Structure

```text
layer-7-presentation/
├── dashboard/           # Next.js App
│   ├── components/
│   ├── pages/
│   └── hooks/
├── api/                 # Fastify Server
│   ├── routes/
│   └── controllers/
└── telegram-bot/        # Bot Logic
    ├── commands/
    └── notifier/
```

## Testing
- **E2E Testing**: Use Cypress or Playwright for critical user flows on the Dashboard.
- **API Testing**: Use `supertest` or `fastify.inject` to test endpoints.

```javascript
// Example API Test
test('GET /signals returns 200', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/signals'
  });
  expect(response.statusCode).toBe(200);
});
```
