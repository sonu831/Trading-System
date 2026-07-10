const executionStateSchema = {
  description: 'Current execution engine state: trade mode, kill switch, positions and risk envelope',
  tags: ['Execution'],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            mode: { type: ['string', 'null'], enum: ['paper', 'shadow', 'live', null] },
            killSwitch: { type: ['boolean', 'null'] },
            positions: { type: 'array', items: { type: 'object', additionalProperties: true } },
            risk: { type: ['object', 'null'], additionalProperties: true },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  },
};

const killSchema = {
  description: 'Halt all new entries and square off open positions. Persisted across restarts.',
  tags: ['Execution'],
};

const resumeSchema = {
  description: 'Clear the kill switch and allow new entries again.',
  tags: ['Execution'],
};

const squareOffSchema = {
  description: 'Close all open positions at market. Does not set the kill switch.',
  tags: ['Execution'],
};

module.exports = { executionStateSchema, killSchema, resumeSchema, squareOffSchema };
