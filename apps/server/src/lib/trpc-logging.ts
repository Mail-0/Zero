import type { TRPCError } from '@trpc/server';
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

        try {
            // Execute the TRPC call
            output = await opts.next();

            // Log successful call
            const callData: Omit<TRPCCallLog, 'id' | 'timestamp'> = {
                userId: userId || 'anonymous',
                sessionId,
                procedure: opts.path,
                input: opts.input,
                output: output,
                duration: Date.now() - startTime,
                metadata: {
                    method: opts.type,
                    userAgent: c.req.header('User-Agent'),
                    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
                },
            };

            // Log asynchronously to avoid blocking the response
            logTRPCCall(sessionId, callData).catch((err) => {
                console.error('Failed to log TRPC call:', err);
            });

        } catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error';

            // Log failed call
            const callData: Omit<TRPCCallLog, 'id' | 'timestamp'> = {
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
                },
            };

            // Log asynchronously to avoid blocking the response
            logTRPCCall(sessionId, callData).catch((logErr) => {
                console.error('Failed to log TRPC error:', logErr);
            });

            throw err;
        }

        return output;
    };
}; 