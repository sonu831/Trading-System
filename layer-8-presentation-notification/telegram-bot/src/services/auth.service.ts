const redis = require('../core/redis');
const logger = require('../core/logger');

class AuthService {
  constructor() {
    this.redis = redis;
    this.subscriberKey = 'telegram:subscribers';
  }

  async subscribeUser(chatId, username) {
    try {
      await this.redis.publisher.sAdd(this.subscriberKey, chatId.toString());
      logger.info({ chatId, username }, 'User subscribed');
      return true;
    } catch (err) {
      logger.error({ err, chatId }, 'Subscription failed');
      return false;
    }
  }

  async unsubscribeUser(chatId) {
    try {
      await this.redis.publisher.sRem(this.subscriberKey, chatId.toString());
      logger.info({ chatId }, 'User unsubscribed');
      return true;
    } catch (err) {
      logger.error({ err, chatId }, 'Unsubscription failed');
      return false;
    }
  }

  async getAllSubscribers() {
    return this.redis.publisher.sMembers(this.subscriberKey);
  }

  async isSubscribed(chatId) {
    return this.redis.publisher.sIsMember(this.subscriberKey, chatId.toString());
  }
}

// Export singleton
module.exports = new AuthService();
