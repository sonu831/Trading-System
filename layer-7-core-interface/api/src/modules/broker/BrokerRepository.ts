const BaseRepository = require('../../common/repositories/BaseRepository');

interface ProviderRow { id: number; provider: string; enabled: boolean; role: string; priority: number; status: string | null; last_tested_at: string | null; created_at: string; updated_at: string; credentials?: CredentialRow[]; }
interface CredentialRow { field_name: string; ciphertext: string; iv: string; tag: string; is_active: boolean; }
interface SessionRow { provider: string; token_hash: string | null; status: string | null; expires_at: string | null; last_error: string | null; }

class BrokerRepository extends BaseRepository {
  async findAllProviders(): Promise<ProviderRow[]> { return this.prisma.broker_providers.findMany({ include: { credentials: { select: { field_name: true, is_active: true } } }, orderBy: { priority: 'asc' } }); }
  async findProviderById(id: number): Promise<ProviderRow | null> { return this.prisma.broker_providers.findUnique({ where: { id }, include: { credentials: true } }); }
  async findProviderByName(provider: string): Promise<ProviderRow | null> { return this.prisma.broker_providers.findUnique({ where: { provider }, include: { credentials: true } }); }
  async createProvider(data: Record<string, unknown>): Promise<ProviderRow> { return this.prisma.broker_providers.create({ data }); }
  async updateProvider(id: number, data: Record<string, unknown>): Promise<ProviderRow> { return this.prisma.broker_providers.update({ where: { id }, data }); }
  async deleteProvider(id: number): Promise<ProviderRow> { return this.prisma.broker_providers.delete({ where: { id } }); }
  async upsertCredential(providerId: number, fieldName: string, ciphertext: string, iv: string, tag: string): Promise<CredentialRow> { return this.prisma.broker_credentials.upsert({ where: { provider_id_field_name: { provider_id: providerId, field_name: fieldName } }, create: { provider_id: providerId, field_name: fieldName, ciphertext, iv, tag }, update: { ciphertext, iv, tag, updated_at: new Date() } }); }
  async saveSession(provider: string, tokenHash: string, status: string, expiresAt: Date): Promise<SessionRow> { return this.prisma.broker_sessions.upsert({ where: { provider }, create: { provider, token_hash: tokenHash, status, expires_at: expiresAt, last_login_at: new Date() }, update: { token_hash: tokenHash, status, expires_at: expiresAt, last_login_at: new Date(), last_error: null } }); }
  async findSession(provider: string): Promise<SessionRow | null> { return this.prisma.broker_sessions.findUnique({ where: { provider } }); }
  async publishConfigChange(provider: string): Promise<void> { await this.redis.publisher?.publish('providers-changed', JSON.stringify({ provider, timestamp: Date.now() })); }
}

export = { BrokerRepository };
