/**
 * Signal Schema Definitions for Swagger
 */
const signalObject = {
  type: 'object',
  properties: {
    symbol: { type: 'string', example: 'TATAMOTORS' },
    timestamp: { type: 'string', format: 'date-time' },
    action: { type: 'string', enum: ['BUY', 'SELL', 'HOLD'] },
    confidence: { type: 'number', example: 0.85 },
    price: { type: 'number', example: 450.5 },
    strategy: { type: 'string', example: 'RSI_MACD_CROSSOVER' },
    stopLoss: { type: 'number', example: 440.0 },
    target: { type: 'number', example: 470.0 },
  },
};

const getSignalsSchema = {
  description: 'Retrieve latest trading signals',
  tags: ['Signals'],
  summary: 'Get all recent signals',
  response: {
    200: {
      description: 'Successful Response',
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Success' },
        data: {
          type: 'array',
          items: signalObject,
        },
      },
    },
    500: {
      description: 'Server Error',
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string' },
      },
    },
  },
};

module.exports = {
  getSignalsSchema,
};
