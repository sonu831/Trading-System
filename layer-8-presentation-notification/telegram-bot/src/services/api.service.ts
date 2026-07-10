const axios = require('axios');
const config = require('../config');
const logger = require('../core/logger');

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: config.api.backend,
      timeout: config.features.requestTimeout || 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add logging interceptor
    this.client.interceptors.request.use((request) => {
      logger.info(
        { url: request.url, baseURL: request.baseURL, method: request.method },
        '🌐 API Request'
      );
      return request;
    });

    this.client.interceptors.response.use(
      (response) => {
        logger.info({ url: response.config.url, status: response.status }, '✅ API Success');
        return response;
      },
      (error) => {
        logger.error(
          {
            url: error.config?.url,
            message: error.message,
            code: error.code,
            response: error.response?.data,
          },
          '❌ API Error'
        );
        return Promise.reject(error);
      }
    );
  }

  async getNews() {
    try {
      const response = await this.client.get('/news');
      return response.data; // Expected { success: true, count: N, data: [] }
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to fetch news from backend');
      return { success: false, data: [] };
    }
  }

  async getSystemHealth() {
    try {
      const response = await this.client.get('/health/detailed');
      return response.data; // Expected { components: { redis: 'UP', ... }, overall: 'HEALTHY' }
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to fetch system health');
      return null;
    }
  }

  async submitSuggestion(text, username) {
    try {
      const response = await this.client.post('/suggestions', {
        text,
        user: username,
        source: 'telegram',
      });
      return response.data; // { success: true, message: '...' }
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to submit suggestion');
      return { success: false, error: 'API Error' };
    }
  }
}

module.exports = new ApiService();
