interface PrismaDelegate {
  count(args: { where?: Record<string, unknown> }): Promise<number>;
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
}

interface PrismaClient {
  [model: string]: PrismaDelegate;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: Record<string, unknown>): Promise<void>;
  isOpen: boolean;
  publisher?: { publish(channel: string, message: string): Promise<void> };
}

class BaseRepository {
  protected prisma: PrismaClient;
  protected redis: RedisClient;

  constructor({ prisma, redis }: { prisma: PrismaClient; redis: RedisClient }) {
    this.prisma = prisma;
    this.redis = redis;
  }

  protected getModel(modelName: string): PrismaDelegate {
    return this.prisma[modelName];
  }

  async count(modelName: string, where: Record<string, unknown> = {}): Promise<number> {
    return this.getModel(modelName).count({ where });
  }

  async findMany(modelName: string, args: Record<string, unknown> = {}): Promise<unknown[]> {
    return this.getModel(modelName).findMany(args);
  }
}

export = BaseRepository;
export type { PrismaClient, RedisClient };
