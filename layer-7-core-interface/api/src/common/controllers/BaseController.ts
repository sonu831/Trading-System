import type { FastifyReply } from 'fastify';

class BaseController {
  protected sendSuccess(reply: FastifyReply, data: unknown, message = 'Success'): FastifyReply {
    return reply.code(200).send({ success: true, message, data });
  }

  protected sendError(reply: FastifyReply, error: unknown, code = 500): FastifyReply {
    const msg = error instanceof Error ? error.message : String(error || 'Internal Server Error');
    return reply.code(code).send({ success: false, error: msg });
  }
}

export = BaseController;
