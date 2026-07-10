require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { ValidationCheckpoints, CHECKPOINTS } = require('./checkpoints');

const COMMAND = process.argv[2] || 'status';

async function main() {
  const cp = new ValidationCheckpoints();
  const current = cp.getCurrentCheckpoint();

  switch (COMMAND) {
    case 'status':
      console.log('\n=== Validation Roadmap Status ===\n');
      const status = cp.getStatus();
      console.log(`Progress: ${status.progress.completed}/${status.progress.total} checkpoints passed`);
      console.log(`Current: ${status.currentCheckpoint}\n`);
      status.checkpoints.forEach(c => {
        const icon = c.status === 'passed' ? '✅' : c.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${icon} ${c.order}. ${c.label} — ${c.status}`);
        if (c.passedAt) console.log(`     Passed: ${c.passedAt}`);
        if (c.attempts > 0) console.log(`     Attempts: ${c.attempts}`);
      });
      break;

    case 'run':
      const checkpoint = process.argv[3] || current;
      console.log(`Running checkpoint: ${checkpoint}...\n`);

      if (checkpoint === 'backtest') {
        const { runCheck } = require('./backtest-check');
        await runCheck();
      } else if (checkpoint === 'paper') {
        const { runCheck } = require('./paper-check');
        await runCheck();
      } else if (checkpoint === 'shadow') {
        const { runCheck } = require('./shadow-check');
        await runCheck();
      } else if (checkpoint === 'live') {
        const { runCheck } = require('./live-gate');
        await runCheck();
      } else {
        console.log(`Unknown checkpoint: ${checkpoint}`);
        console.log('Valid: backtest, paper, shadow, live');
      }
      break;

    case 'reset':
      cp.reset();
      console.log('Validation state reset.');
      break;

    case 'advance':
      cp.advanceToNext(current);
      console.log(`Advanced to: ${cp.getCurrentCheckpoint()}`);
      break;

    default:
      console.log(`Usage: node run.js [command] [checkpoint]`);
      console.log(`Commands: status, run, reset, advance`);
      console.log(`Checkpoints: backtest, paper, shadow, live`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
