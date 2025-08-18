import type { TRPCCallLog } from './logging-durable-object';
import { logTRPCCall, initializeLoggingSession } from './server-utils';
import { getContext } from 'hono/context-storage';
import type { HonoContext } from '../ctx';

export interface LoggingContext {
    sessionId: string;
    userId?: string;
}

export const createLoggingMiddleware = () => {
    return async (opts: {
        path: string;
        type: 'query' | 'mutation' | 'subscription';
        next: () => Promise<any>;
        input: any;
        ctx: any;
    }) => {

        const startTime = Date.now();
        const c = getContext<HonoContext>();
        const sessionId = c.var.sessionUser?.id || 'anonymous';
        const userId = c.var.sessionUser?.id;

        // Initialize session if this is the first call

        if (userId) {
            try {
                await initializeLoggingSession(sessionId, userId);
            } catch (error) {
                console.error('Failed to initialize logging session:', error);
            }
        }

        let output: any;
        let error: string | undefined;

        // Start TRPC procedure execution span
        const { addRequestSpan, completeRequestSpan } = await import('./trace-context');
        const procedureSpan = addRequestSpan(c, 'trpc_procedure_execution', {
            procedure: opts.path,
            type: opts.type,
            hasInput: !!opts.input,
            inputSize: opts.input ? JSON.stringify(opts.input).length : 0,
        }, {
            'trpc.procedure': opts.path,
            'trpc.type': opts.type,
        });

        try {
            // Execute the TRPC call
            output = await opts.next();

            // Complete procedure span
            if (procedureSpan) {
                completeRequestSpan(c, procedureSpan.id, {
                    success: true,
                    hasOutput: !!output,
                    outputSize: output ? JSON.stringify(output).length : 0,
                });
            }

            // Sanitize output to remove non-serializable objects
            const sanitizeOutput = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (typeof obj !== 'object') return obj;
                if (Array.isArray(obj)) return obj.map(sanitizeOutput);

                const sanitized: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    // Skip known non-serializable fields
                    if (key === 'ctx' && value && typeof value === 'object') {
                        // Skip the ctx field entirely as it contains Fetcher/Context objects
                        continue;
                    }

                    try {
                        // Test if the value can be serialized
                        structuredClone(value);
                        sanitized[key] = sanitizeOutput(value);
                    } catch (err) {
                        // If it can't be serialized, replace with a description
                        sanitized[key] = `[Non-serializable: ${value?.constructor?.name || typeof value}]`;
                    }
                }
                return sanitized;
            };

            // Log successful call
            const callData: TRPCCallLog = {
                id: crypto.randomUUID(),
                timestamp: startTime,
                userId: userId || 'anonymous',
                sessionId,
                procedure: opts.path,
                input: opts.input,
                output: sanitizeOutput(output),
                duration: Date.now() - startTime,
                metadata: {
                    method: opts.type,
                    userAgent: c.req.header('User-Agent'),
                    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
                    referer: c.req.header('Referer'),
                    origin: c.req.header('Origin'),
                    acceptLanguage: c.req.header('Accept-Language'),
                    acceptEncoding: c.req.header('Accept-Encoding'),
                    requestId: c.req.header('X-Request-Id') || crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    startTime,
                    endTime: Date.now(),
                },
            };

            // Log to Durable Object which will immediately export to Datadog
            if (c.env && userId) {
                const { getRequestTrace } = await import('./trace-context');

                // Get the complete trace for this request
                const trace = getRequestTrace(c);

                // Add trace to call data
                if (trace) {
                    callData.trace = {
                        traceId: trace.traceId,
                        requestStartTime: trace.startTime,
                        requestEndTime: trace.endTime,
                        requestDuration: trace.duration,
                        spans: trace.spans,
                        totalSpans: trace.spans.length,
                        completedSpans: trace.spans.filter(s => s.status === 'completed').length,
                        errorSpans: trace.spans.filter(s => s.status === 'error').length,
                    };
                    callData.metadata.traceId = trace.traceId;
                    callData.metadata.requestDuration = trace.duration;
                }

                // Send to DO which will immediately log to Datadog
                logTRPCCall(sessionId, callData).catch((err) => {
                    console.error('Failed to log TRPC call:', err);
                });

                // Complete the trace after logging
                if (trace) {
                    const { TraceContext } = await import('./trace-context');
                    TraceContext.completeTrace(trace.traceId);
                }
            }

        } catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error';

            // Complete procedure span with error
            if (procedureSpan) {
                completeRequestSpan(c, procedureSpan.id, {
                    success: false,
                    errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
                }, error);
            }

            // Log failed call
            const callData: TRPCCallLog = {
                id: crypto.randomUUID(),
                timestamp: startTime,
                userId: userId || 'anonymous',
                sessionId,
                procedure: opts.path,
                input: opts.input,
                error,
                duration: Date.now() - startTime,
                metadata: {
                    method: opts.type,
                    userAgent: c.req.header('User-Agent'),
                    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
                    referer: c.req.header('Referer'),
                    origin: c.req.header('Origin'),
                    acceptLanguage: c.req.header('Accept-Language'),
                    acceptEncoding: c.req.header('Accept-Encoding'),
                    requestId: c.req.header('X-Request-Id') || crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    startTime,
                    endTime: Date.now(),
                },
            };

            // Log error to Durable Object which will immediately export to Datadog
            if (c.env && userId) {
                const { getRequestTrace } = await import('./trace-context');

                // Get the complete trace for this request
                const trace = getRequestTrace(c);

                // Add trace to call data
                if (trace) {
                    callData.trace = {
                        traceId: trace.traceId,
                        requestStartTime: trace.startTime,
                        requestEndTime: trace.endTime,
                        requestDuration: trace.duration,
                        spans: trace.spans,
                        totalSpans: trace.spans.length,
                        completedSpans: trace.spans.filter(s => s.status === 'completed').length,
                        errorSpans: trace.spans.filter(s => s.status === 'error').length,
                    };
                    callData.metadata.traceId = trace.traceId;
                    callData.metadata.requestDuration = trace.duration;
                }

                // Send to DO which will immediately log to Datadog
                logTRPCCall(sessionId, callData).catch((logErr) => {
                    console.error('Failed to log TRPC error:', logErr);
                });

                // Complete the trace after logging error
                if (trace) {
                    const { TraceContext } = await import('./trace-context');
                    TraceContext.completeTrace(trace.traceId);
                }
            }

            throw err;
        }

        return output;
    };
}; 