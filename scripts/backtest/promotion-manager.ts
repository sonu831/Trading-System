const fs = require('fs');
const path = require('path');

const PROMOTIONS_PATH = path.join(__dirname, 'promotions.json');

class PromotionManager {
  constructor() {
    this.promotions = this.load();
  }

  load() {
    try {
      if (fs.existsSync(PROMOTIONS_PATH)) {
        return JSON.parse(fs.readFileSync(PROMOTIONS_PATH, 'utf-8'));
      }
    } catch (e) { /* ignore */ }
    return { pending: [], active: [], history: [] };
  }

  save() {
    fs.writeFileSync(PROMOTIONS_PATH, JSON.stringify(this.promotions, null, 2));
  }

  propose(strategyId, params, testResult, description) {
    const entry = {
      id: `promo-${Date.now()}`,
      strategyId,
      params,
      testResult: {
        profitFactor: testResult.profitFactor,
        expectancy: testResult.expectancy,
        winRate: testResult.winRate,
        totalTrades: testResult.total,
        sharpe: testResult.sharpe,
        maxDrawdown: testResult.maxDrawdown,
      },
      description,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewer: null,
      decision: null,
    };

    this.promotions.pending.push(entry);
    this.save();
    return entry;
  }

  approve(promotionId, reviewer) {
    const idx = this.promotions.pending.findIndex(p => p.id === promotionId);
    if (idx === -1) return null;

    const promo = this.promotions.pending[idx];
    promo.status = 'ACTIVE';
    promo.reviewedAt = new Date().toISOString();
    promo.reviewer = reviewer;
    promo.decision = 'APPROVED';

    this.promotions.pending.splice(idx, 1);
    this.promotions.active.push(promo);
    this.promotions.history.push({ ...promo, action: 'promoted_to_live' });
    this.save();
    return promo;
  }

  reject(promotionId, reviewer, reason) {
    const idx = this.promotions.pending.findIndex(p => p.id === promotionId);
    if (idx === -1) return null;

    const promo = this.promotions.pending[idx];
    promo.status = 'REJECTED';
    promo.reviewedAt = new Date().toISOString();
    promo.reviewer = reviewer;
    promo.decision = 'REJECTED';
    promo.rejectionReason = reason;

    this.promotions.pending.splice(idx, 1);
    this.promotions.history.push({ ...promo, action: 'rejected' });
    this.save();
    return promo;
  }

  demote(strategyId, reason) {
    const idx = this.promotions.active.findIndex(p => p.strategyId === strategyId);
    if (idx === -1) return null;

    const promo = this.promotions.active[idx];
    promo.status = 'DEMOTED';
    promo.demotedAt = new Date().toISOString();
    promo.demotionReason = reason;

    this.promotions.active.splice(idx, 1);
    this.promotions.history.push({ ...promo, action: 'demoted' });
    this.save();
    return promo;
  }

  getPending() { return this.promotions.pending; }
  getActive() { return this.promotions.active; }
  getHistory() { return this.promotions.history; }
}

module.exports = { PromotionManager };
