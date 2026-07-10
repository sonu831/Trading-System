const BaseRepository = require('../../common/repositories/BaseRepository');

class MarketRepository extends BaseRepository {
  constructor({ redis }) {
    super({ redis });
  }

  async getLatestMarketView() {
    try {
      // Fetch pre-computed market view from Redis
      const view = await this.redis.get('market_view:latest');
      // If view is a string, we might want to parse it?
      // Existing index.js sends it raw or object. Redis get returns string or null usually in recent node-redis if not configured.
      // But Fastify serialization handles object.
      // Let's assume redis client handles parsing if configured, or we return string.
      // Based on existing code logic: `const view = await redis.get(...)`.
      // It returns it directly.
      if (typeof view === 'string') {
        try {
          return JSON.parse(view);
        } catch (e) {
          return view;
        }
      }
      return view;
    } catch (e) {
      return null;
    }
  }
}

module.exports = MarketRepository;
