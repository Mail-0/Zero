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

    createTrace(traceId: string, metadata: RequestTrace['metadata']): RequestTrace {
        const existing = this.traces.get(traceId);
        if (existing) return existing;
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
        if (metadata) span.metadata = { ...span.metadata, ...metadata };
    }

    completeTrace(traceId: string): RequestTrace | undefined {
        const trace = this.traces.get(traceId);
        if (!trace) return;

        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;

        // Clean up completed trace after a delay to allow for any async operations
        setTimeout(() => {
            this.traces.delete(traceId);
        }, 30000); // 30 seconds

        return trace;
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