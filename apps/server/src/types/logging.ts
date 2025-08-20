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

export interface TRPCCallLog {
    id: string;
    timestamp: number;
    userId: string;
    sessionId: string;
    procedure: string;
    input: any;
    output?: any;
    error?: string;
    duration: number;
    metadata: {
        userAgent?: string;
        ip?: string;
        method: 'query' | 'mutation' | 'subscription';
        // Additional metadata
        referer?: string;
        origin?: string;
        acceptLanguage?: string;
        acceptEncoding?: string;
        requestId?: string;
        timestamp?: string;
        startTime?: number;
        endTime?: number;
        // Trace information
        traceId?: string;
        requestDuration?: number;
    };
    // Complete trace spans for this request
    trace?: {
        traceId: string;
        requestStartTime: number;
        requestEndTime?: number;
        requestDuration?: number;
        spans: TraceSpan[];
        totalSpans: number;
        completedSpans: number;
        errorSpans: number;
    };
}

export interface LoggingState {
    sessionId: string;
    userId: string;
    startedAt: number;
    lastActivity: number;
    totalCalls: number;
    totalErrors: number;
    totalDuration: number;
}

export interface SessionStats {
    totalCalls: number;
    totalErrors: number;
    totalDuration: number;
    averageDuration: number;
    errorRate: number;
    sessionDuration: number;
}
