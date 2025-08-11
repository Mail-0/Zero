import { DurableObject } from 'cloudflare:workers';
import { Queryable } from 'dormroom';
import type { ZeroEnv } from '../env';
import { DatadogService } from './datadog-service';

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
    };
}

export interface LoggingState {
    sessionId: string;
    userId: string;
    calls: TRPCCallLog[];
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
    private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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

        // Get current state
        const currentState = await this.getState();

        // Check if session has expired
        const timeSinceLastActivity = Date.now() - currentState.lastActivity;
        if (timeSinceLastActivity > this.SESSION_TIMEOUT && currentState.calls.length > 0) {
            // Export expired session to Datadog
            await this.exportSessionToDatadog(currentState);

            // Start new session
            await this.clearSession();
            const newState = await this.getState();
            newState.userId = currentState.userId; // Preserve user ID
            await this.state.storage.put('state', newState);
        }

        // Add the new call
        currentState.calls.push(log);
        currentState.lastActivity = log.timestamp;
        currentState.totalCalls++;
        currentState.totalDuration += log.duration;

        if (log.error) {
            currentState.totalErrors++;
        }

        // Keep only last 1000 calls to prevent memory issues
        if (currentState.calls.length > 1000) {
            currentState.calls = currentState.calls.slice(-1000);
        }

        // Store updated state
        await this.state.storage.put('state', currentState);
    }

    async getState(): Promise<LoggingState> {
        const state = await this.state.storage.get<LoggingState>('state');
        if (!state) {
            // Initialize new state
            const newState: LoggingState = {
                sessionId: crypto.randomUUID(),
                userId: '',
                calls: [],
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

    async getCallHistory(limit: number = 100): Promise<TRPCCallLog[]> {
        const state = await this.getState();
        return state.calls.slice(-limit);
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
            calls: [],
            startedAt: Date.now(),
            lastActivity: Date.now(),
            totalCalls: 0,
            totalErrors: 0,
            totalDuration: 0,
        };
        await this.state.storage.put('state', newState);
    }

    async exportSessionToDatadog(state: LoggingState): Promise<void> {
        if (state.calls.length === 0) return;

        try {
            await this.datadogService.exportSessionLogs(
                state.sessionId,
                state.userId,
                state.calls
            );
        } catch (error) {
            console.error('Failed to export session to Datadog:', error);
        }
    }

    async exportCurrentSessionToDatadog(): Promise<void> {
        const state = await this.getState();
        await this.exportSessionToDatadog(state);
    }

    async endSession(): Promise<void> {
        const state = await this.getState();
        if (state.calls.length > 0) {
            await this.exportSessionToDatadog(state);
        }
        await this.clearSession();
    }
} 