class BaseController {
  constructor() {}

  sendSuccess(reply, data, message = 'Success') {
    return reply.code(200).send({
      success: true,
      message,
      data,
    });
  }

  sendError(reply, error, code = 500) {
    return reply.code(code).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
}

module.exports = BaseController;
