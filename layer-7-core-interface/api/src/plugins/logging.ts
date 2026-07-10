const fp = require('fastify-plugin');

async function loggingPlugin(fastify, options) {
  // Hook: On Request (Start Timer)
  fastify.addHook('onRequest', async (req, reply) => {
    req.hrStartTime = process.hrtime();
  });

  // Hook: On Response (Log Details)
  fastify.addHook('onResponse', async (req, reply) => {
    const hrDuration = process.hrtime(req.hrStartTime);
    const durationMs = (hrDuration[0] * 1000 + hrDuration[1] / 1e6).toFixed(2);

    const logData = {
      level: 'info',
      timestamp: new Date().toISOString(),
      reqId: req.id,
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
      duration_ms: parseFloat(durationMs),
      vendor: req.vendor ? { id: req.vendor.id, name: req.vendor.vendor_name } : null,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    // Log to standard output (Docker logs picks this up)
    // Fastify's logger is Pino, so we can use existing instance or console.
    // Using console.log for raw JSON stream separate from internal fastify logs if needed,
    // but better to use fastify.log to merge with system logs.

    // We only log "access" here. Avoid duplicate standard logs if disableRequestLogging is on.
    fastify.log.info(logData, 'API Request Completed');
  });
}

module.exports = fp(loggingPlugin);
