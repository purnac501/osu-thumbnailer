export interface QueueStatus {
  queuedCount: number;
  activeCount: number;
  totalProcessed: number;
  estWaitMs: number;
  safeLimitPerMinute: number;
}

export interface QueueRunStats {
  waitTimeMs: number;
  queuePosition: number;
}

/**
 * Concurrency controller and queue manager for osu! API requests.
 * Enforces rate limits well below the osu! API v2 cap (1200 req/min)
 * to guarantee zero spamming or 429 rate limit errors from upstream osu! servers.
 */
export class OsuRequestQueue {
  private queue: Array<{
    id: string;
    enqueuedAt: number;
    resolve: () => void;
    reject: (err: unknown) => void;
  }> = [];
  private activeCount = 0;
  private maxConcurrent = 2; // At most 2 concurrent batch lookups
  private minIntervalMs = 300; // Minimum 300ms spacing between starting API calls (max 200/min, safely under osu!'s 1200/min)
  private lastStartTime = 0;
  private totalProcessed = 0;

  getStatus(): QueueStatus {
    const queuedCount = this.queue.length;
    const estWaitMs = (queuedCount + this.activeCount) * 1200;
    return {
      queuedCount,
      activeCount: this.activeCount,
      totalProcessed: this.totalProcessed,
      estWaitMs,
      safeLimitPerMinute: 120,
    };
  }

  async run<T>(fn: () => Promise<T>): Promise<{ result: T; queueStats: QueueRunStats }> {
    const id = Math.random().toString(36).slice(2, 9);
    const enqueuedAt = Date.now();
    const queuePosition = this.queue.length + 1;

    await new Promise<void>((resolve, reject) => {
      this.queue.push({ id, enqueuedAt, resolve, reject });
      this.processNext();
    });

    const startedAt = Date.now();
    const waitTimeMs = startedAt - enqueuedAt;

    try {
      const result = await fn();
      this.totalProcessed++;
      return { result, queueStats: { waitTimeMs, queuePosition } };
    } finally {
      this.activeCount = Math.max(0, this.activeCount - 1);
      this.processNext();
    }
  }

  private processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;

    const now = Date.now();
    const timeSinceLast = now - this.lastStartTime;
    const delay = Math.max(0, this.minIntervalMs - timeSinceLast);

    if (delay > 0) {
      setTimeout(() => this.processNext(), delay);
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    this.activeCount++;
    this.lastStartTime = Date.now();
    next.resolve();
  }
}

export const globalOsuQueue = new OsuRequestQueue();
