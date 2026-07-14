const fp = require('fastify-plugin');
const crypto = require('crypto');

/* eslint-disable @typescript-eslint/no-var-requires */
let SHARED: any = null;
try { SHARED = require('/app/shared/constants'); } catch (_) {
  try { SHARED = require('../../../../shared/constants'); } catch (_e) { SHARED = null; }
}
if (!SHARED?.API_KEY_HEADER) {
  throw new Error('shared/constants.js API_KEY_HEADER not resolvable — auth cannot start');
}
const API_KEY_HEADER: string = SHARED.API_KEY_HEADER;

/**
 * INTERNAL_API_KEY — the shared secret the trusted callers present:
 *   dashboard (Next.js proxy, server-side) · L1 ingestion · L10 execution
 *
 * It is NOT stored in the api_keys table: those rows are per-vendor keys for external
 * consumers. A service key that lived in the DB would need seeding before the stack could
 * boot, and a bootstrap chicken-and-egg is how "temporarily allow everything" gets shipped.
 *
 * Absent => the process refuses to start (see index.ts). We never fall back to open access:
 * this API can return DECRYPTED broker credentials and can halt live trading.
 */
const INTERNAL_API_KEY: string = process.env.INTERNAL_API_KEY || '';

/** Constant-time compare that does not leak length (hash both sides first). */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function authMiddleware(fastify, options) {
  fastify.decorate('authenticate', async (req, reply) => {
    const { prisma, redis } = fastify.container.cradle;
    try {
      const apiKey = req.headers[API_KEY_HEADER];

      // Default-deny. A missing header is a rejection, not a reason to skip the check.
      if (!apiKey) {
        return reply.code(401).send({ error: `Missing ${API_KEY_HEADER} header` });
      }

      // Internal service key — checked before the DB so L1/L10/dashboard never depend on
      // a seeded row, and so a DB outage cannot silently open or close the control plane.
      if (INTERNAL_API_KEY && safeEqual(apiKey, INTERNAL_API_KEY)) {
        req.vendor = { id: 0, vendor_name: 'internal-service', user_id: null, role: 'internal' };
        return;
      }

      const cacheKey = `auth:key:${crypto.createHash('sha256').update(String(apiKey)).digest('hex')}`;

      // 1. Try Cache
      let vendor = null;
      if (redis.isOpen) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          vendor = JSON.parse(cached);
        }
      }

      // 2. Try DB
      if (!vendor) {
        const keyRecord = await prisma.api_keys.findUnique({
          where: { key: apiKey },
          include: { users: true },
        });

        if (!keyRecord || !keyRecord.is_active) {
          return reply.code(403).send({ error: 'Invalid or inactive API Key' });
        }

        // 3. Set Cache (60 seconds)
        vendor = {
          id: keyRecord.id,
          vendor_name: keyRecord.vendor_name,
          user_id: keyRecord.user_id,
          rate_limit: keyRecord.rate_limit,
          role: keyRecord.users?.is_premium ? 'premium' : 'standard',
        };

        if (redis.isOpen) {
          await redis.set(cacheKey, JSON.stringify(vendor), { EX: 60 });
        }
      }

      // Attach to request
      req.vendor = vendor;
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Authentication Failed' });
    }
  });
}

module.exports = fp(authMiddleware);
