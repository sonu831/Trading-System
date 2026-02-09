const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function trigger() {
  const publisher = createClient({ url: REDIS_URL });
  await publisher.connect();

  console.log('Connected to Redis. Publishing test events...');

  // 1. Suggestion
  await publisher.publish('notifications:suggestions', JSON.stringify({
    user: 'sonu831',
    text: 'Please add a "Global Search" feature to the dashboard.',
    source: 'Web App'
  }));
  console.log('Sent Suggestion');

  // 2. Backfill
  await publisher.publish('notifications:backfill', JSON.stringify({
    symbol: 'TATASTEEL',
    rows: 4500,
    duration: '1m 20s'
  }));
  console.log('Sent Backfill');

  // 3. System Alert
  await publisher.publish('system:alerts', JSON.stringify({
    message: 'Memory usage warning: EmailService is using 150MB.'
  }));
  console.log('Sent System Alert');

  // 4. System Down
  await publisher.publish('system:down', JSON.stringify({
    service: 'Market Data Feed',
    error: 'WebSocket disconnected abnormally'
  }));
  console.log('Sent System Down');

  // 5. System Up
  await publisher.publish('system:up', JSON.stringify({
    service: 'Market Data Feed',
    downtime: '45s'
  }));
  console.log('Sent System Up');

  await publisher.quit();
  console.log('Done!');
}

trigger().catch(console.error);
