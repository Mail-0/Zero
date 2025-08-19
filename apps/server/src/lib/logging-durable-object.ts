import { DurableObject } from 'cloudflare:workers';
import { Queryable } from 'dormroom';
import type { ZeroEnv } from '../env';
import { DatadogService } from './datadog-service';

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

@Queryable()
export class LoggingDurableObject extends DurableObject<ZeroEnv> {
    private state: DurableObjectState;
    protected env: ZeroEnv;
    private datadogService: DatadogService;

    constructor(state: DurableObjectState, env: ZeroEnv) {
        super(state, env);
        this.state = state;
        this.env = env;
        this.datadogService = new DatadogService(env);
    }

    async logCall(callData: Omit<TRPCCallLog, 'id' | 'timestamp'>): Promise<void> {
        const log: TRPCCallLog = {
            ...callData,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };

        // Immediately export to Datadog (no session storage)
        try {
            await this.datadogService.logSingleCall(
                callData.sessionId,
                callData.userId,
                log
            );
        } catch (error) {
            console.error('❌ Failed to log TRPC call to Datadog:', error);
        }

        // Optional: Keep minimal stats for dashboard (no call storage)
        const currentState = await this.getState();
        currentState.lastActivity = log.timestamp;
        currentState.totalCalls++;
        currentState.totalDuration += log.duration;

        if (log.error) {
            currentState.totalErrors++;
        }

        // Save updated stats only (no call arrays)
        await this.state.storage.put('state', currentState);
    }

    async getState(): Promise<LoggingState> {
        const state = await this.state.storage.get<LoggingState>('state');
        if (!state) {
            // Initialize new state
            const newState: LoggingState = {
                sessionId: crypto.randomUUID(),
                userId: '',
                startedAt: Date.now(),
                lastActivity: Date.now(),
                totalCalls: 0,
                totalErrors: 0,
                totalDuration: 0,
            };
            await this.state.storage.put('state', newState);
            return newState;
        }
        return state;
    }

    async initializeSession(userId: string): Promise<void> {
        const state = await this.getState();
        state.userId = userId;
        state.sessionId = crypto.randomUUID();
        state.startedAt = Date.now();
        state.lastActivity = Date.now();
        await this.state.storage.put('state', state);
    }

    async getSessionStats(): Promise<{
        totalCalls: number;
        totalErrors: number;
        totalDuration: number;
        averageDuration: number;
        errorRate: number;
        sessionDuration: number;
    }> {
        const state = await this.getState();
        const sessionDuration = Date.now() - state.startedAt;

        return {
            totalCalls: state.totalCalls,
            totalErrors: state.totalErrors,
            totalDuration: state.totalDuration,
            averageDuration: state.totalCalls > 0 ? state.totalDuration / state.totalCalls : 0,
            errorRate: state.totalCalls > 0 ? (state.totalErrors / state.totalCalls) * 100 : 0,
            sessionDuration,
        };
    }

    async clearSession(): Promise<void> {
        const newState: LoggingState = {
            sessionId: crypto.randomUUID(),
            userId: '',
            startedAt: Date.now(),
            lastActivity: Date.now(),
            totalCalls: 0,
            totalErrors: 0,
            totalDuration: 0,
        };
        await this.state.storage.put('state', newState);
    }
} 