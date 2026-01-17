const express = require('express');
const client = require('prom-client');
const app = express();
const port = process.env.PORT || 7000;

// Prometheus Registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5]
});
register.registerMetric(httpRequestDurationMicroseconds);

// Middleware
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

// Metrics Endpoint
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Telegram Bot Alive' });
});

app.listen(port, () => {
  console.log(`Telegram Bot listening on port ${port}`);
});

// Mock Bot Logic
setInterval(() => {
  console.log("🤖 Checking for alerts to push...");
}, 10000);
