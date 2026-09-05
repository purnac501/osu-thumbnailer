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
export class OsuRequestQueue {
    private queue: Array<() => void> = [];
    private activeCount = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private lastStartTime = 0;
    private totalProcessed = 0;
    constructor(private readonly maxConcurrent = 2, private readonly minIntervalMs = 300, private readonly maxQueued = 50) { }
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
    async run<T>(fn: () => Promise<T>): Promise<{
        result: T;
        queueStats: QueueRunStats;
    }> {
        if (this.queue.length >= this.maxQueued)
            throw new Error("Score request queue is full");
        const enqueuedAt = Date.now();
        const queuePosition = this.queue.length + 1;
        await new Promise<void>((resolve) => {
            this.queue.push(resolve);
            this.processNext();
        });
        const startedAt = Date.now();
        const waitTimeMs = startedAt - enqueuedAt;
        try {
            const result = await fn();
            this.totalProcessed++;
            return { result, queueStats: { waitTimeMs, queuePosition } };
        }
        finally {
            this.activeCount = Math.max(0, this.activeCount - 1);
            this.processNext();
        }
    }
    private processNext() {
        if (this.activeCount >= this.maxConcurrent || this.queue.length === 0)
            return;
        const now = Date.now();
        const timeSinceLast = now - this.lastStartTime;
        const delay = Math.max(0, this.minIntervalMs - timeSinceLast);
        if (delay > 0) {
            this.timer ??= setTimeout(() => {
                this.timer = null;
                this.processNext();
            }, delay);
            return;
        }
        const next = this.queue.shift();
        if (!next)
            return;
        this.activeCount++;
        this.lastStartTime = Date.now();
        next();
        this.processNext();
    }
}
export const globalOsuQueue = new OsuRequestQueue();
