const fs = require('fs');
const path = require('path');
const NotificationEmail = require('../src/presentation/templates/NotificationEmail');

const outputDir = path.join(__dirname, '../previews');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const samples = [
  {
    filename: 'alert.html',
    props: {
      title: '🚨 System Alert: API High Latency',
      message: 'The backend API is experiencing high latency (> 2000ms). The auto-scaler has been triggered.',
      type: 'alert',
      timestamp: new Date()
    }
  },
  {
    filename: 'backfill.html',
    props: {
      title: '📥 Backfill Complete: RELIANCE',
      message: 'Historical data backfill for RELIANCE has completed successfully.',
      details: { Symbol: 'RELIANCE', Rows: 15420, Duration: '4m 32s', Source: 'NSE' },
      type: 'backfill',
      timestamp: new Date()
    }
  },
  {
    filename: 'system_down.html',
    props: {
      title: '🚨 CRITICAL: Redis Connection Lost',
      message: 'The application cannot connect to the Redis cache. Retrying in 5s.',
      details: { Service: 'Cache Layer', Error: 'ECONNREFUSED 127.0.0.1:6379' },
      type: 'system_down',
      timestamp: new Date()
    }
  },
  {
    filename: 'system_up.html',
    props: {
      title: '✅ System Recovered: Redis Cache',
      message: 'Connection to Redis has been restored. All systems operational.',
      details: { Service: 'Cache Layer', Downtime: '2m 15s' },
      type: 'system_up',
      timestamp: new Date()
    }
  },
  {
    filename: 'suggestion.html',
    props: {
      title: '💡 New Suggestion: Dark Mode',
      message: 'It would be great if we could schedule backfills for the weekend.',
      details: { User: 'sonu831', Source: 'Dashboard Feedback' },
      type: 'info',
      timestamp: new Date()
    }
  }
];

console.log('Generating HTML previews...');
samples.forEach(sample => {
  const html = NotificationEmail(sample.props);
  fs.writeFileSync(path.join(outputDir, sample.filename), html);
  console.log(`- Created ${sample.filename}`);
});
console.log(`\nPreviews saved to ${outputDir}`);
