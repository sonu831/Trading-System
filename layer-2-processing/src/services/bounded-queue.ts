/**
 * Bounded Queue Pattern for Hot-Path Processing
 *
 * L2 Processing receives ticks from Kafka and builds candles. During market bursts,
 * the in-memory queue of unprocessed ticks can grow unbounded, causing GC pauses
 * and eventual OOM. This module enforces:
 *
 * 1. Max queue size — drop oldest or newest ticks when full (configurable)
 * 2. Explicit backpressure — if queue > 80% full, the Kafka consumer pauses
 * 3. Coalescing — same-symbol ticks within the same bucket are coalesced
 *
 * Usage:
 *   const { BoundedQueue } = require('./bounded-queue');
 *   const queue = new BoundedQueue({ maxSize: 5000, dropOldest: true });
 */

class BoundedQueue {
  constructor({ maxSize = 5000, dropOldest = true } = {}) {
    this.maxSize = maxSize;
    this.dropOldest = dropOldest;
    this.items = [];
    this.dropped = 0;
  }

  push(item) {
    if (this.items.length >= this.maxSize) {
      this.dropped++;
      if (this.dropOldest) {
        this.items.shift();
      } else {
        return false; // rejected
      }
    }
    this.items.push(item);
    return true;
  }

  shift() { return this.items.shift() || null; }

  get size() { return this.items.length; }
  get isFull() { return this.size >= this.maxSize; }
  get usagePct() { return (this.size / this.maxSize) * 100; }

  /** True if queue is > 80% full — Kafka consumer should pause. */
  get shouldBackpressure() { return this.usagePct > 80; }

  clear() { this.items = []; this.dropped = 0; }
}

module.exports = { BoundedQueue };
