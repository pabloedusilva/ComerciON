// Background service to emit real-time updates at open/close boundaries
const StoreStatus = require('../models/StoreStatus');
const StoreHours = require('../models/StoreHours');
const { computeEffectiveClosed, getNextBoundary, composePublicStatus } = require('../utils/storeStatus');

class StoreMonitor {
  constructor(io) {
    this.io = io;
    this.timer = null;
    this.running = false;
  }

  async loadState() {
    const status = await StoreStatus.get();
    const hours = await StoreHours.getAll();
    return { status, hours };
  }

  async emitUpdate(reason = 'tick') {
    try {
      const { status, hours } = await this.loadState();
      const payload = composePublicStatus(status, hours);
      // Emit to both admin and public namespaces to force clients to refresh
      this.io?.of('/admin').emit('dashboard:update', { reason, status: payload });
      this.io?.of('/cliente').emit('store:status', payload);
    } catch (_) { /* noop */ }
  }

  schedule(nextAt) {
    if (this.timer) clearTimeout(this.timer);
    if (!nextAt) return;
    const delay = Math.max(0, nextAt.getTime() - Date.now());
    // Cap maximum delay to avoid setTimeout overflow and allow periodic recalibration (e.g., 24h)
    const maxDelay = 24 * 60 * 60 * 1000; // 24h
    const actualDelay = Math.min(delay, maxDelay);
    this.timer = setTimeout(() => this.tick(), actualDelay);
  }

  async tick() {
    try {
      const { status, hours } = await this.loadState();
      // Emit update right at the boundary to notify clients instantly
      await this.emitUpdate('boundary');
      // Recompute next boundary and schedule next tick
      const nextAt = getNextBoundary(status, hours, new Date());
      this.schedule(nextAt);
    } catch (e) {
      // In case of error, retry after 1 minute
      this.timer = setTimeout(() => this.tick(), 60 * 1000);
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    const { status, hours } = await this.loadState();
    const nextAt = getNextBoundary(status, hours, new Date());
    this.schedule(nextAt);
  }

  async refresh() {
    // Called when admin updates status or hours; re-schedule precisely
    const { status, hours } = await this.loadState();
    const nextAt = getNextBoundary(status, hours, new Date());
    this.schedule(nextAt);
    // Also emit an immediate update so clients refresh instantly
    await this.emitUpdate('refresh');
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

module.exports = StoreMonitor;
