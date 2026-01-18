/**
 * Global Axios Interceptor
 *
 * Patches axios globally to automatically track ALL HTTP calls
 * across the entire application, including SDK internal calls.
 *
 * Call setupGlobalInterceptor() at the very start of your app,
 * BEFORE importing any SDKs or libraries that use axios.
 */

const axios = require('axios');
const { metrics } = require('./metrics');
const { logger } = require('./logger');

let isSetup = false;

/**
 * Extract vendor name from URL
 */
function extractVendor(url) {
  if (!url) return 'unknown';

  try {
    const hostname = new URL(url).hostname;

    const vendorMap = {
      'api.mstock.trade': 'mstock',
      'mstock.trade': 'mstock',
      'api.kite.trade': 'kite',
      'kite.zerodha.com': 'kite',
      'flattrade.in': 'flattrade',
      'api.flattrade.in': 'flattrade',
      'ws.kite.trade': 'kite_ws',
    };

    if (vendorMap[hostname]) return vendorMap[hostname];

    // Check partial match
    for (const [key, value] of Object.entries(vendorMap)) {
      if (hostname.includes(key.replace('api.', '').replace('ws.', ''))) return value;
    }

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
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;

    // Simplify path
    pathname = pathname
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/gi, '/:uuid')
      .replace(/\/\d{4}-\d{2}-\d{2}/g, '/:date');

    return pathname.substring(0, 60) || '/';
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Setup global axios interceptors
 */
function setupGlobalInterceptor() {
  if (isSetup) {
    logger.debug('Axios interceptor already set up');
    return;
  }

  // Request Interceptor
  axios.interceptors.request.use(
    (config) => {
      config.metadata = {
        startTime: Date.now(),
        vendor: extractVendor(config.url),
        endpoint: extractEndpoint(config.url),
      };
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response Interceptor - Success
  axios.interceptors.response.use(
    (response) => {
      const { startTime, vendor, endpoint } = response.config?.metadata || {};
      if (startTime) {
        const latency = (Date.now() - startTime) / 1000;

        metrics.externalApiCalls.inc({ vendor, endpoint, status: 'success' });
        metrics.externalApiLatency.observe({ vendor, endpoint }, latency);

        logger.debug(`📊 API: ${vendor}${endpoint} | ${response.status} | ${latency.toFixed(3)}s`);
      }
      return response;
    },
    (error) => {
      const { startTime, vendor, endpoint } = error.config?.metadata || {};
      if (startTime) {
        const latency = (Date.now() - startTime) / 1000;
        const statusCode = error.response?.status || 'network';

        metrics.externalApiCalls.inc({ vendor, endpoint, status: `error_${statusCode}` });
        metrics.externalApiLatency.observe({ vendor, endpoint }, latency);

        logger.debug(`📊 API: ${vendor}${endpoint} | ERROR ${statusCode} | ${latency.toFixed(3)}s`);
      }
      return Promise.reject(error);
    }
  );

  isSetup = true;
  logger.info('✅ Global Axios Interceptor initialized - All HTTP calls will be tracked');
}

module.exports = { setupGlobalInterceptor, extractVendor, extractEndpoint };
