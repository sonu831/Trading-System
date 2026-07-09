const BaseRepository = require('../../common/repositories/BaseRepository');

class BrokerRepository extends BaseRepository {
  constructor({ prisma, redis }) {
    super({ prisma, redis });
  }

  async findAllProviders() {
    return this.prisma.broker_providers.findMany({
      include: { credentials: { select: { field_name: true, is_active: true } } },
      orderBy: { priority: 'asc' },
    });
  }

  async findProviderById(id) {
    return this.prisma.broker_providers.findUnique({
      where: { id },
      include: { credentials: true },
    });
  }

  async findProviderByName(provider) {
    return this.prisma.broker_providers.findUnique({
      where: { provider },
      include: { credentials: true },
    });
  }

  async createProvider(data) {
    return this.prisma.broker_providers.create({ data });
  }

  async updateProvider(id, data) {
    return this.prisma.broker_providers.update({ where: { id }, data });
  }

  async upsertCredential(providerId, fieldName, ciphertext, iv, tag) {
    return this.prisma.broker_credentials.upsert({
      where: { provider_id_field_name: { provider_id: providerId, field_name: fieldName } },
      create: { provider_id: providerId, field_name: fieldName, ciphertext, iv, tag },
      update: { ciphertext, iv, tag, updated_at: new Date() },
    });
  }

  async findCredentials(providerId) {
    return this.prisma.broker_credentials.findMany({
      where: { provider_id: providerId, is_active: true },
    });
  }

  async saveSession(provider, tokenHash, status, expiresAt) {
    return this.prisma.broker_sessions.upsert({
      where: { provider },
      create: {
        provider,
        token_hash: tokenHash,
        status,
        expires_at: expiresAt,
        last_login_at: new Date(),
      },
      update: {
        token_hash: tokenHash,
        status,
        expires_at: expiresAt,
        last_login_at: new Date(),
        last_error: null,
      },
    });
  }

  async updateSessionStatus(provider, status, error) {
    return this.prisma.broker_sessions.update({
      where: { provider },
      data: { status, last_error: error, updated_at: new Date() },
    });
  }

  async findSession(provider) {
    return this.prisma.broker_sessions.findUnique({ where: { provider } });
  }

  async deleteProvider(id) {
    return this.prisma.broker_providers.delete({ where: { id } });
  }

  async publishConfigChange(provider) {
    await this.redis.publisher.publish('providers-changed', JSON.stringify({ provider, timestamp: Date.now() }));
  }
}

module.exports = BrokerRepository;
