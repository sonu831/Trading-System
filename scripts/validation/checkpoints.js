const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, 'validation-state.json');

const CHECKPOINTS = {
  BACKTEST: {
    id: 'backtest',
    label: 'Signal + Option-Leg Backtest',
    order: 1,
    thresholds: {
      profitFactor: { min: 1.3, label: 'Profit Factor' },
      expectancy: { min: 0.25, label: 'Expectancy (R)' },
      minTrades: { min: 60, label: 'Minimum Trades' },
    },
  },
  PAPER: {
    id: 'paper',
    label: 'Paper Trading (Simulated Fills)',
    order: 2,
    thresholds: {
      minDays: { min: 14, label: 'Minimum Days' },
      minTrades: { min: 20, label: 'Minimum Trades' },
      maxAvgSlippagePct: { max: 0.5, label: 'Avg Slippage %' },
    },
  },
  SHADOW: {
    id: 'shadow',
    label: 'Shadow Trading (Manual Execution)',
    order: 3,
    thresholds: {
      minDays: { min: 7, label: 'Minimum Days' },
      minTrades: { min: 10, label: 'Minimum Manual Trades' },
      shadowAccuracy: { min: 0.6, label: 'Shadow Accuracy (manual follows signal)' },
    },
  },
  LIVE: {
    id: 'live',
    label: 'Live Trading (1 Lot)',
    order: 4,
    thresholds: {
      sebiRegistered: { required: true, label: 'SEBI Algo Registration' },
      brokerConfirmed: { required: true, label: 'Broker Rate Limits Confirmed' },
      minTradesBeforeScale: { min: 20, label: 'Trades Before Scaling Up' },
    },
  },
};

class ValidationCheckpoints {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(STATE_PATH)) {
        return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
      }
    } catch (e) { /* ignore */ }
    return {
      startedAt: new Date().toISOString(),
      currentCheckpoint: 'backtest',
      checkpoints: {},
    };
  }

  save() {
    fs.writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  getCheckpoint(id) {
    return this.state.checkpoints[id] || { status: 'pending', attempts: [], passedAt: null };
  }

  recordAttempt(checkpointId, result) {
    const cp = this.getCheckpoint(checkpointId);
    cp.attempts = cp.attempts || [];
    cp.attempts.push({
      timestamp: new Date().toISOString(),
      passed: result.passed,
      metrics: result.metrics,
      errors: result.errors,
    });
    if (result.passed) {
      cp.status = 'passed';
      cp.passedAt = new Date().toISOString();
      this.advanceToNext(checkpointId);
    } else {
      cp.status = 'failed';
    }
    this.state.checkpoints[checkpointId] = cp;
    this.save();
    return cp;
  }

  advanceToNext(currentId) {
    const order = Object.values(CHECKPOINTS).sort((a, b) => a.order - b.order);
    const currentIdx = order.findIndex(c => c.id === currentId);
    if (currentIdx >= 0 && currentIdx < order.length - 1) {
      this.state.currentCheckpoint = order[currentIdx + 1].id;
    }
  }

  getCurrentCheckpoint() {
    return this.state.currentCheckpoint;
  }

  getStatus() {
    const order = Object.values(CHECKPOINTS).sort((a, b) => a.order - b.order);
    return {
      startedAt: this.state.startedAt,
      currentCheckpoint: this.state.currentCheckpoint,
      progress: {
        completed: order.filter(c => this.getCheckpoint(c.id).status === 'passed').length,
        total: order.length,
      },
      checkpoints: order.map(c => ({
        id: c.id,
        label: c.label,
        order: c.order,
        status: this.getCheckpoint(c.id).status,
        passedAt: this.getCheckpoint(c.id).passedAt,
        attempts: (this.getCheckpoint(c.id).attempts || []).length,
      })),
    };
  }

  reset() {
    this.state = {
      startedAt: new Date().toISOString(),
      currentCheckpoint: 'backtest',
      checkpoints: {},
    };
    this.save();
  }

  static getThresholds(checkpointId) {
    return CHECKPOINTS[checkpointId.toUpperCase()]?.thresholds || {};
  }
}

module.exports = { ValidationCheckpoints, CHECKPOINTS };
