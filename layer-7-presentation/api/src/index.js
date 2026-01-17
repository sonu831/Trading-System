const express = require('express');
const client = require('prom-client');
const app = express();
const port = process.env.PORT || 4000;

// Create Registry and Metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});
register.registerMetric(httpRequestDurationMicroseconds);

app.use(express.json());

// Middleware to measure requests
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

// Expose Metrics Endpoint
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Layer 7 API Alive' });
});

app.get('/api/signals', (req, res) => {
  res.json([
    { symbol: 'NIFTY', type: 'BUY', score: 0.85, timestamp: new Date() }
  ]);
});

app.listen(port, () => {
  console.log(`🚀 Layer 7 API Server listening on port ${port}`);
});
