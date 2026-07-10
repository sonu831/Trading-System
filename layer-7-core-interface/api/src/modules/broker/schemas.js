const providerListSchema = {
  description: 'List all broker providers with live status',
  tags: ['Providers'],
  summary: 'Get configured providers (secrets masked)',
  response: {
    200: {
      description: 'Provider list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
};

const credentialSaveSchema = {
  description: 'Save broker credentials (encrypted at rest)',
  tags: ['Providers'],
  summary: 'Add or update a credential field',
  body: {
    type: 'object',
    required: ['field_name', 'field_value'],
    properties: {
      field_name: { type: 'string', enum: ['api_key', 'client_code', 'password', 'totp_secret', 'access_token'] },
      field_value: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: {
      description: 'Credential saved',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
};

module.exports = { providerListSchema, credentialSaveSchema };
