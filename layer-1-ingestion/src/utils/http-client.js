/**
 * HTTP Client with Prometheus Metrics Interceptor
 *
 * Centralized HTTP client that automatically tracks all external API calls.
 * Exposes metrics for call count, latency, and errors.
 *
 * Usage:
 *   const { httpClient } = require('./http-client');
 *   const response = await httpClient.get('https://api.mstock.trade/endpoint');
 */

const axios = require('axios');
const { metrics } = require('./metrics');
const { logger } = require('./logger');

// Create axios instance with interceptors
const httpClient = axios.create({
  timeout: 30000, // 30 second timeout
});

// Request Interceptor - Attach start time
httpClient.interceptors.request.use(
  (config) => {
    config.metadata = { startTime: Date.now() };

    // Extract vendor name from URL
    config.metadata.vendor = extractVendor(config.url);
    config.metadata.endpoint = extractEndpoint(config.url);

    logger.debug(`📤 External API Call: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - Track metrics on success
httpClient.interceptors.response.use(
  (response) => {
    const { startTime, vendor, endpoint } = response.config.metadata || {};
    const latency = (Date.now() - startTime) / 1000;

    // Track metrics
    metrics.externalApiCalls.inc({ vendor, endpoint, status: 'success' });
    metrics.externalApiLatency.observe({ vendor, endpoint }, latency);

    logger.debug(`✅ External API Response: ${response.status} in ${latency.toFixed(3)}s`);
    return response;
  },
  (error) => {
    const { startTime, vendor, endpoint } = error.config?.metadata || {};
    const latency = startTime ? (Date.now() - startTime) / 1000 : 0;
    const status = error.response?.status || 'network_error';

    // Track error metrics
    metrics.externalApiCalls.inc({ vendor, endpoint, status: `error_${status}` });
    metrics.externalApiLatency.observe({ vendor, endpoint }, latency);

    logger.error(`❌ External API Error: ${vendor}/${endpoint} - ${error.message}`);
    return Promise.reject(error);
  }
);

/**
 * Extract vendor name from URL
 */
function extractVendor(url) {
  if (!url) return 'unknown';

  try {
    const hostname = new URL(url).hostname;

    // Map hostnames to vendor names
    const vendorMap = {
      'api.mstock.trade': 'mstock',
      'api.kite.trade': 'kite',
      'kite.zerodha.com': 'kite',
      'flattrade.in': 'flattrade',
      'api.flattrade.in': 'flattrade',
    };

    // Check direct match
    if (vendorMap[hostname]) return vendorMap[hostname];

    // Check partial match
    for (const [key, value] of Object.entries(vendorMap)) {
      if (hostname.includes(key.replace('api.', ''))) return value;
    }

    // Return hostname as fallback
    return hostname.split('.')[0];
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Extract endpoint from URL path
 */
function extractEndpoint(url) {
  if (!url) return 'unknown';

  try {
    const pathname = new URL(url).pathname;
    // Simplify path (remove IDs, dates, etc.)
    return pathname
      .replace(/\/\d+/g, '/:id') // Replace numeric IDs
      .replace(/\/[a-f0-9-]{36}/gi, '/:uuid') // Replace UUIDs
      .replace(/\/\d{4}-\d{2}-\d{2}/g, '/:date') // Replace dates
      .substring(0, 50); // Limit length
  } catch (e) {
    return 'unknown';
  }
}

module.exports = { httpClient, extractVendor, extractEndpoint };
