import type { TRPCCallLog, LoggingState, SessionStats } from '../types/logging';
import { DatadogService } from './datadog-service';
import type { ZeroEnv } from '../env';

// In-memory session storage for stats
// In a production environment, you might want to use a distributed cache like Redis
const sessionStats = new Map<string, LoggingState>();

export class LoggingService {
    private datadogService: DatadogService;

    constructor(env: ZeroEnv) {
        this.datadogService = new DatadogService(env);
    }

    async logCall(callData: Omit<TRPCCallLog, 'id' | 'timestamp'>): Promise<void> {
        const log: TRPCCallLog = {
            ...callData,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };

        // Immediately export to Datadog
        try {
            await this.datadogService.logSingleCall(
                callData.sessionId,
                callData.userId,
                log
            );
        } catch (error) {
            console.error('❌ Failed to log TRPC call to Datadog:', error);
        }

        // Update in-memory session stats
        this.updateSessionStats(callData.sessionId, callData.userId, log);
    }

    private updateSessionStats(sessionId: string, userId: string, log: TRPCCallLog): void {
        let currentState = sessionStats.get(sessionId);

        if (!currentState) {
            currentState = {
                sessionId,
                userId,
                startedAt: Date.now(),
                lastActivity: Date.now(),
                totalCalls: 0,
                totalErrors: 0,
                totalDuration: 0,
            };
        }

        currentState.lastActivity = log.timestamp;
        currentState.totalCalls++;
        currentState.totalDuration += log.duration;

        if (log.error) {
            currentState.totalErrors++;
        }

        sessionStats.set(sessionId, currentState);
    }

    getState(sessionId: string): LoggingState {
        let state = sessionStats.get(sessionId);
        if (!state) {
            // Initialize new state
            state = {
                sessionId,
                userId: '',
                startedAt: Date.now(),
                lastActivity: Date.now(),
                totalCalls: 0,
                totalErrors: 0,
                totalDuration: 0,
            };
            sessionStats.set(sessionId, state);
        }
        return state;
    }

    initializeSession(sessionId: string, userId: string): void {
        const state = this.getState(sessionId);
        state.userId = userId;
        state.sessionId = sessionId;
        state.startedAt = Date.now();
        state.lastActivity = Date.now();
        sessionStats.set(sessionId, state);
    }

    getSessionStats(sessionId: string): SessionStats {
        const state = this.getState(sessionId);
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

    clearSession(sessionId: string): void {
        const newState: LoggingState = {
            sessionId,
            userId: '',
            startedAt: Date.now(),
            lastActivity: Date.now(),
            totalCalls: 0,
            totalErrors: 0,
            totalDuration: 0,
        };
        sessionStats.set(sessionId, newState);
    }
}
