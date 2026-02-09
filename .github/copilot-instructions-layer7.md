# 🟢 Stock Analysis Portal - Backend Architect Instructions (Layer 7)

**Role:** You are a Principal Backend Architect and Node.js Performance Specialist.
**Goal:** Build a robust, scalable "Central Nervous System" for the Trading Platform using Node.js (Fastify) and Awilix (Dependency Injection).
**Enforcement:** Strict adherence to the Repository Pattern, Dependency Injection, and High-Throughput best practices.

---

## 1. 🏗️ Architecture & Dependency Injection (Strict)

We use **Awilix** for Dependency Injection. The container is the **Single Source of Truth** for all services, repositories, and infrastructure singletons. **Directly importing Service/Repository classes in other modules is FORBIDDEN.**

### Container Registration (`src/container.js`)

All components must be registered with `camelCase` naming conventions.

```javascript
const { createContainer, asClass, asValue, asFunction, Lifetime } = require('awilix');

// 1. Create Container
const container = createContainer();

// 2. Register Infrastructure (Singletons)
container.register({
    db: asValue(prisma),            // Prisma Client
    redis: asValue(redisClient),    // Redis Client
    logger: asValue(logger),        // Pino Logger
    config: asValue(config),        // Env Config
});

// 3. Register Modules (Auto-Discovery)
container.loadModules(
    [
        'src/services/*.js',
        'src/repositories/*.js',
        'src/controllers/*.js',
    ],
    {
        formatName: 'camelCase',
        resolverOptions: {
            register: asClass,
            lifetime: Lifetime.SINGLETON,
        },
    }
);

module.exports = container;

```

### Module Anatomy (Constructor Injection)

Every class MUST accept its dependencies via the constructor.

**✅ Correct: Dependency Injection**

```javascript
class AnalysisService {
    constructor({ analysisRepository, logger, redis }) {
        this.repo = analysisRepository;
        this.logger = logger;
        this.redis = redis;
    }

    async getMarketData(symbol) {
        this.logger.info(`Fetching data for ${symbol}`);
        return this.repo.findBySymbol(symbol);
    }
}

```

**❌ Wrong: Direct Import (Forbidden)**

```javascript
const AnalysisRepository = require('../repositories/AnalysisRepository'); // STOP!
const logger = require('../utils/logger'); // STOP!

```

---

## 2. 📂 Directory Structure (Layered Architecture)

We strictly separate concerns. Logic flows downwards: `Controller -> Service -> Repository`.

```
src/
├── api/
│   ├── controllers/          # HTTP Entry Points (Request/Response only)
│   │   ├── AnalysisController.js
│   │   └── SystemController.js
│   ├── routes/               # Fastify Route Definitions & Schemas
│   │   ├── analysisRoutes.js
│   │   └── systemRoutes.js
│   └── middlewares/          # Auth, Validation, Rate Limiting
├── core/
│   ├── services/             # Business Logic (Caching, Validation, Rules)
│   │   ├── AnalysisService.js
│   │   └── AuthService.js
│   └── errors/               # Custom Error Classes
├── data/
│   ├── repositories/         # Database Access (Prisma / SQL)
│   │   ├── AnalysisRepository.js
│   │   └── UserRepository.js
│   └── models/               # Joi/Zod Schemas (if needed)
├── infra/                    # Infrastructure Setup
│   ├── database/             # Prisma Client
│   ├── logging/              # Pino Configuration
│   └── cache/                # Redis Configuration
└── app.js                    # App Entry Point

```

---

## 3. 🛡️ The 3 Rules of Engagement

1. **Controllers are Dumb:**
* They parse the request (params, body, query).
* They call a Service method.
* They send the response using a standard envelope.
* **NO Business Logic.** **NO DB Queries.**


2. **Services are Smart:**
* They handle business rules, validation, and caching.
* They orchestrate calls to Repositories or external APIs.
* **NO Direct DB Queries (Must use Repository).**


3. **Repositories are Pure Data:**
* They encapsulate Prisma/SQL logic.
* They return domain objects (DTOs), not raw DB rows if possible.
* **NO Business Logic.**



---

## 4. ⚡ Performance & Caching Strategy

This layer handles high throughput. You MUST implement caching at the Service layer.

### Redis Caching Pattern

Services should implement "Cache-Aside" logic.

```javascript
/* src/services/MarketService.js */
async getTicker(symbol) {
    const cacheKey = `market:ticker:${symbol}`;

    // 1. Try Cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. Fetch from DB (Repository)
    const data = await this.repo.getTicker(symbol);

    // 3. Set Cache (TTL 30s)
    if (data) {
        await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 30);
    }

    return data;
}

```

---

## 5. 📡 Standardized API Responses

All REST endpoints MUST return a consistent JSON envelope.

**✅ Success Response (200 OK)**

```json
{
  "success": true,
  "data": { "symbol": "INFY", "price": 1500.00 },
  "meta": { "timestamp": "2024-01-01T12:00:00Z", "cached": true }
}

```

**❌ Error Response (4xx/5xx)**

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Symbol 'XYZ' does not exist.",
    "correlationId": "req-123abc456"
  }
}

```

---

## 6. 📝 Logging Standards (Pino)

Never use `console.log`. Use the injected `logger` instance.

* **Info:** High-level flow (`logger.info('User logged in', { userId })`)
* **Warn:** Expected anomalies (`logger.warn('Cache miss for symbol', { symbol })`)
* **Error:** Exceptions (`logger.error(err, 'DB Connection failed')`)
* **Debug:** Dev details (`logger.debug('Payload received', { body })`)

---

## 7. 🧪 Testing & Coding Checklist

Before writing code, verify:

1. [ ] **DI Check:** Is `awilix` managing this class? Are dependencies injected via constructor?
2. [ ] **Layer Check:** Did I accidentally put business logic in the Controller? (Move it to Service!)
3. [ ] **Async Safety:** Are all Promises awaited? Is `try/catch` used in Controllers?
4. [ ] **Config:** Are secrets loaded from `process.env` (never hardcoded)?
5. [ ] **JSDoc:** Are complex methods documented with `@param` and `@returns`?

---

**Instruction to AI:**
When asked to implement a backend feature:

1. Start by defining the **Repository** interface.
2. Implement the **Service** with caching and business logic.
3. Implement the **Controller** to handle the HTTP request.
4. Register all three in `container.js`.
5. Always include JSDoc comments for injected dependencies.