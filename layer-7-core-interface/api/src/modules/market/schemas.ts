/**
 * Market Schema Definitions
 */

const marketViewSchema = {
  description: 'Get Market Overview',
  tags: ['Market'],
  summary: 'Get pre-computed market view',
  response: {
    200: {
      description: 'Market View Data',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          additionalProperties: true, // Dynamic view structure
        },
      },
    },
  },
};

module.exports = {
  marketViewSchema,
};
