export interface TraceSpan {
    id: string;
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: 'started' | 'completed' | 'error';
    metadata?: Record<string, any>;
    error?: string;
    tags?: Record<string, string>;
}

export interface RequestTrace {
    traceId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    spans: TraceSpan[];
    metadata: {
        procedure?: string;
        userId?: string;
        sessionId?: string;
        ip?: string;
        userAgent?: string;
        requestId?: string;
    };
}

class TraceContextClass {
    private traces = new Map<string, RequestTrace>();
    private readonly MAX_TRACES = 10000; // Maximum number of traces to keep in memory
    private readonly TRACE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for uncompleted traces
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Start periodic cleanup every 2 minutes
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 2 * 60 * 1000);
    }

    /**
     * Performs cleanup of stale traces based on TTL and enforces max size
     */
    private performCleanup(): void {
        const now = Date.now();
        const tracesToDelete: string[] = [];

        // Find traces that have exceeded TTL
        for (const [traceId, trace] of this.traces) {
            const age = now - trace.startTime;
            if (age > this.TRACE_TTL_MS) {
                tracesToDelete.push(traceId);
            }
        }

        // Remove stale traces
        for (const traceId of tracesToDelete) {
            this.traces.delete(traceId);
        }

        // If still over max size, remove oldest traces (LRU-style eviction)
        if (this.traces.size > this.MAX_TRACES) {
            const sortedTraces = Array.from(this.traces.entries())
                .sort(([, a], [, b]) => a.startTime - b.startTime);

            const excessCount = this.traces.size - this.MAX_TRACES;
            for (let i = 0; i < excessCount; i++) {
                this.traces.delete(sortedTraces[i][0]);
            }
        }

        // Log cleanup statistics in development
        if (tracesToDelete.length > 0 || this.traces.size > this.MAX_TRACES * 0.8) {
            console.debug(`Trace cleanup: removed ${tracesToDelete.length} stale traces, ${this.traces.size} traces remaining`);
        }
    }

    /**
     * Get current trace statistics for monitoring
     */
    getStats(): { totalTraces: number; oldestTraceAge: number } {
        if (this.traces.size === 0) {
            return { totalTraces: 0, oldestTraceAge: 0 };
        }

        const now = Date.now();
        let oldestAge = 0;
        for (const trace of this.traces.values()) {
            const age = now - trace.startTime;
            oldestAge = Math.max(oldestAge, age);
        }

        return {
            totalTraces: this.traces.size,
            oldestTraceAge: oldestAge,
        };
    }

    createTrace(traceId: string, metadata: RequestTrace['metadata']): RequestTrace {
        const existing = this.traces.get(traceId);
        if (existing) return existing;

        // Trigger cleanup if we're approaching max capacity
        if (this.traces.size >= this.MAX_TRACES * 0.9) {
            this.performCleanup();
        }

        const trace: RequestTrace = {
            traceId,
            startTime: Date.now(),
            spans: [],
            metadata,
        };
        this.traces.set(traceId, trace);
        return trace;
    }

    getTrace(traceId: string): RequestTrace | undefined {
        return this.traces.get(traceId);
    }

    addSpan(traceId: string, span: Omit<TraceSpan, 'id' | 'startTime' | 'status'>): TraceSpan {
        const trace = this.traces.get(traceId);
        if (!trace) {
            throw new Error(`Trace not found: ${traceId}`);
        }

        const fullSpan: TraceSpan = {
            id: crypto.randomUUID(),
            startTime: Date.now(),
            status: 'started',
            ...span,
        };

        trace.spans.push(fullSpan);
        return fullSpan;
    }

    completeSpan(traceId: string, spanId: string, metadata?: Record<string, any>, error?: string): void {
        const trace = this.traces.get(traceId);
        if (!trace) return;

        const span = trace.spans.find(s => s.id === spanId);
        if (!span) return;

        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = error ? 'error' : 'completed';
        if (error) span.error = error;
        if (metadata) {
            span.metadata = span.metadata ? { ...span.metadata, ...metadata } : metadata;
        }
    }

    completeTrace(traceId: string): RequestTrace | undefined {
        const trace = this.traces.get(traceId);
        if (!trace) return;

        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;

        setTimeout(() => {
            this.traces.delete(traceId);
        }, 10000);

        return trace;
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.traces.clear();
    }

    // Helper to create and immediately start a span
    startSpan(traceId: string, name: string, metadata?: Record<string, any>, tags?: Record<string, string>): TraceSpan {
        return this.addSpan(traceId, {
            name,
            metadata,
            tags,
        });
    }
}

export const TraceContext = new TraceContextClass();

// Helper function to safely get trace from request context using context variables
export function getRequestTrace(c: any): RequestTrace | undefined {
    // Try to get trace ID from context variables (set in main.ts)
    const traceId = c?.var?.traceId || c?.get?.('traceId');

    // Fallback to headers if context variables aren't available
    if (!traceId) {
        const headerTraceId = c.req?.header?.('X-Trace-ID') ||
            c.req?.header?.('x-trace-id') ||
            c.req?.headers?.get?.('X-Trace-ID') ||
            c.req?.headers?.get?.('x-trace-id');

        if (!headerTraceId) {
            return undefined;
        }

        return TraceContext.getTrace(headerTraceId);
    }

    return TraceContext.getTrace(traceId);
}

// Helper function to get trace ID from context variables or headers
export function getTraceId(c: any): string | undefined {
    return c?.var?.traceId || c?.get?.('traceId') || c.req?.header?.('X-Trace-ID') || c.req?.header?.('x-trace-id');
}

// Helper function to safely add span to current request
export function addRequestSpan(c: any, name: string, metadata?: Record<string, any>, tags?: Record<string, string>): TraceSpan | undefined {
    const traceId = getTraceId(c);
    if (!traceId) return undefined;

    return TraceContext.startSpan(traceId, name, metadata, tags);
}

// Helper function to complete span in current request
export function completeRequestSpan(c: any, spanId: string, metadata?: Record<string, any>, error?: string): void {
    const traceId = getTraceId(c);
    if (!traceId) return;

    TraceContext.completeSpan(traceId, spanId, metadata, error);
}

// Helper function to get trace context statistics for monitoring
export function getTraceStats(): { totalTraces: number; oldestTraceAge: number } {
    return TraceContext.getStats();
}

// Helper function for graceful shutdown
export function destroyTraceContext(): void {
    TraceContext.destroy();
}