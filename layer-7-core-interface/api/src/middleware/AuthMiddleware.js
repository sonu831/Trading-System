const fp = require('fastify-plugin');

async function authMiddleware(fastify, options) {
  fastify.decorate('authenticate', async (req, reply) => {
    const { prisma, redis } = fastify.container.cradle;
    try {
      const apiKey = req.headers['x-api-key'];

      if (!apiKey) {
        return reply.code(401).send({ error: 'Missing X-API-KEY header' });
      }

      const cacheKey = `auth:key:${apiKey}`;

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

      // Update Rate Limit Context (if we want dynamic limits per vendor)
      // Fastify Rate Limit plugin usually runs BEFORE this,
      // but we can use this for business logic validation.
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Authentication Failed' });
    }
  });
}

module.exports = fp(authMiddleware);
