/**
 * Kafka Health Check
 *
 * Waits for Kafka broker to be available and optionally verifies
 * that a specific topic has partition leaders.
 */

const { recordHealthCheck, recordRetry } = require('./metrics');

const DEFAULT_CONFIG = {
  maxRetries: 20,
  delayMs: 3000,
  connectionTimeout: 10000,
};

/**
 * Wait for Kafka to be ready
 * @param {Object} options - Configuration options
 * @param {string[]} options.brokers - Kafka broker addresses
 * @param {string} [options.topic] - Topic to verify (optional)
 * @param {number} [options.maxRetries=20] - Maximum retry attempts
 * @param {number} [options.delayMs=3000] - Delay between retries in ms
 * @param {Function} [options.logger=console] - Logger instance
 * @returns {Promise<boolean>} - True if Kafka is ready
 */
async function waitForKafka(options) {
  const {
    brokers,
    topic,
    maxRetries = DEFAULT_CONFIG.maxRetries,
    delayMs = DEFAULT_CONFIG.delayMs,
    connectionTimeout = DEFAULT_CONFIG.connectionTimeout,
    logger = console,
  } = options;

  // Normalize logger - support both console (log) and pino (info)
  const log = (msg) => (logger.info || log).call(logger, msg);
  const logError = (msg) => (logError || log).call(logger, msg);

  if (!brokers || brokers.length === 0) {
    throw new Error('Kafka brokers are required');
  }

  const { Kafka } = require('kafkajs');
  const kafka = new Kafka({
    clientId: 'health-check',
    brokers,
    connectionTimeout,
  });

  const admin = kafka.admin();
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await admin.connect();

      let metadata = null;
      if (topic) {
        // Verify topic exists and has leaders
        metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        const topicData = metadata.topics[0];

        if (topicData && topicData.partitions && topicData.partitions.length > 0) {
          const allHaveLeaders = topicData.partitions.every(p => p.leader !== -1);
          if (!allHaveLeaders) {
            throw new Error(`Topic '${topic}' partitions have no leaders yet`);
          }
          log(`✅ Kafka ready - topic '${topic}' has ${topicData.partitions.length} partitions with leaders`);
        } else {
          // Topic doesn't exist yet - broker is ready but topic will be auto-created
          log(`✅ Kafka broker ready (topic '${topic}' will be auto-created)`);
        }
      } else {
        log('✅ Kafka broker ready');
      }

      await admin.disconnect();

      // Record metrics
      const latency = Date.now() - startTime;
      recordHealthCheck('kafka', true, latency, {
        topic,
        partitions: topic ? (metadata?.topics?.[0]?.partitions?.length || 0) : 0,
        partitionsWithLeaders: topic ? (metadata?.topics?.[0]?.partitions?.filter(p => p.leader !== -1).length || 0) : 0,
      });

      return true;

    } catch (error) {
      try { await admin.disconnect(); } catch (e) {}

      if (attempt === maxRetries) {
        // Record failure
        recordHealthCheck('kafka', false, Date.now() - startTime);
        logError(`❌ Kafka not ready after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      // Record retry
      recordRetry('kafka');
      log(`⏳ Waiting for Kafka... (${attempt}/${maxRetries}) - ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

/**
 * Check Kafka health (single attempt)
 * @param {Object} options - Configuration options
 * @returns {Promise<{healthy: boolean, message: string}>}
 */
async function checkKafkaHealth(options) {
  try {
    await waitForKafka({ ...options, maxRetries: 1 });
    return { healthy: true, message: 'Kafka is healthy' };
  } catch (error) {
    return { healthy: false, message: error.message };
  }
}

module.exports = {
  waitForKafka,
  checkKafkaHealth,
  DEFAULT_CONFIG,
};
