class BaseRepository {
  constructor({ prisma, redis }) {
    this.prisma = prisma;
    this.redis = redis;
  }

  // Helper to access Prisma model delegate dynamically
  getModel(modelName) {
    return this.prisma[modelName];
  }

  async count(modelName, where = {}) {
    return this.getModel(modelName).count({ where });
  }

  async findMany(modelName, args = {}) {
    return this.getModel(modelName).findMany(args);
  }
}

module.exports = BaseRepository;
