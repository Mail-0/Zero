import { client, v2 } from '@datadog/datadog-api-client';
import type { TRPCCallLog } from './logging-durable-object';
import type { ZeroEnv } from '../env';

export class DatadogService {
    private apiInstance: v2.LogsApi;
    private apiKey: string;
    private appKey: string;
    private site: string;

    constructor(env?: ZeroEnv) {
        const configuration = client.createConfiguration({
            authMethods: {
                apiKeyAuth: env?.DD_API_KEY || '',
                appKeyAuth: env?.DD_APP_KEY || '',
            },
        });

        // Set the site for the configuration
        if (env?.DD_SITE) {
            configuration.setServerVariables({ site: env.DD_SITE });
        }

        this.apiInstance = new v2.LogsApi(configuration);
        this.apiKey = env?.DD_API_KEY || '';
        this.appKey = env?.DD_APP_KEY || '';
        this.site = env?.DD_SITE || 'datadoghq.com';
    }

    // Simple hash function for generating consistent trace and span IDs
    // According to Datadog docs: https://docs.datadoghq.com/tracing/connect_logs_and_traces
    // Trace IDs must be 32-character lowercase hexadecimal strings
    // Span IDs must be 16-character lowercase hexadecimal strings
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Convert to positive hex string and pad to 32 characters
        const positiveHash = Math.abs(hash).toString(16);
        return positiveHash.padEnd(32, '0').slice(0, 32).toLowerCase();
    }

    async exportSessionLogs(sessionId: string, userId: string, logs: TRPCCallLog[]): Promise<void> {
        if (logs.length === 0) return;

        try {
            const logEntries = logs.map((log, index) => {
                // Generate consistent trace and span IDs for distributed tracing
                // Use session-based trace ID for correlation across all calls in a session
                // Must be 32-character lowercase hexadecimal strings for trace_id
                // Must be 16-character lowercase hexadecimal strings for span_id

                // Create a consistent trace ID based on session and user
                // Using a simple hash function that doesn't require async operations
                // According to Datadog docs: https://docs.datadoghq.com/tracing/connect_logs_and_traces
                const sessionString = `${sessionId}-${userId}`;
                const traceId = this.simpleHash(sessionString).slice(0, 32);

                // Create a span ID based on the specific call
                const callString = `${log.id}-${log.procedure}-${index}`;
                const spanId = this.simpleHash(callString).slice(0, 16);

                // Include ALL possible information in the logs for maximum visibility
                return {
                    message: `TRPC call: ${log.procedure} (${log.duration}ms)`,
                    service: 'zero-mail-app',
                    ddsource: 'trpc-logging',
                    ddtags: `session:${sessionId},user:${userId},procedure:${log.procedure},duration:${log.duration}ms,has_error:${!!log.error}`,
                    hostname: 'cloudflare-worker',
                    timestamp: log.timestamp,
                    // Trace correlation fields - must be nested in 'dd' object                    // According to Datadog docs: https://docs.datadoghq.com/tracing/connect_logs_and_traces
                    dd: {
                        trace_id: traceId,
                        span_id: spanId,
                    },
                    // Environment and version for better correlation
                    env: 'development',
                    version: '1.0.0',
                    // Rich context at root level for better searchability and correlation
                    // Include ALL possible information for maximum visibility
                    procedure: log.procedure,
                    duration: log.duration,
                    session_id: sessionId,
                    user_id: userId,
                    call_id: log.id,
                    performance_category: log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow',
                    has_error: !!log.error,
                    error_message: log.error || null,
                    error_type: log.error ? 'trpc_error' : null,
                    // Additional context for better debugging
                    call_sequence: index + 1,
                    total_calls_in_session: logs.length,
                    session_start_time: logs[0]?.timestamp || log.timestamp,
                    session_duration: logs.length > 1 ? (logs[logs.length - 1]?.timestamp || log.timestamp) - (logs[0]?.timestamp || log.timestamp) : 0,
                    // HTTP context
                    http_method: 'POST',
                    http_url: `/api/trpc/${log.procedure}`,
                    // Request context (if available)
                    request_id: log.id,
                    request_timestamp: log.timestamp,
                    // Performance metrics
                    response_time_ms: log.duration,
                    response_time_category: log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow',
                    // Error details
                    error_details: log.error ? {
                        message: log.error,
                        type: 'trpc_error',
                        procedure: log.procedure,
                        timestamp: log.timestamp
                    } : null,
                    // Input/Output data (truncated for safety)
                    input_data: log.input ? (typeof log.input === 'string' ? log.input.slice(0, 1000) : JSON.stringify(log.input).slice(0, 1000)) : null,
                    output_data: log.output ? (typeof log.output === 'string' ? log.output.slice(0, 1000) : JSON.stringify(log.output).slice(0, 1000)) : null,
                    // Metadata
                    metadata: {
                        session_id: sessionId,
                        user_id: userId,
                        call_id: log.id,
                        procedure: log.procedure,
                        duration: log.duration,
                        timestamp: log.timestamp,
                        has_error: !!log.error,
                        error_message: log.error || null,
                        call_sequence: index + 1,
                        total_calls_in_session: logs.length,
                        performance_category: log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow',
                    }
                };
            });

            console.log('📊 Sending to Datadog:', {
                sessionId,
                userId,
                logCount: logs.length,
                sampleLogEntry: logEntries[0], // Show the first log entry structure
            });

            // Send logs
            const logParams = {
                body: logEntries,
            };
            await this.apiInstance.submitLog(logParams);

            console.log('✅ Successfully exported to Datadog:', {
                sessionId,
                userId,
                logCount: logs.length,
            });
        } catch (error) {
            console.error('❌ Failed to export session logs to Datadog:', error);
        }
    }

    async exportBatchLogs(logs: Array<{ sessionId: string; userId: string; logs: TRPCCallLog[] }>): Promise<void> {
        if (logs.length === 0) return;

        try {
            const allLogEntries: any[] = [];

            for (const { sessionId, userId, logs: sessionLogs } of logs) {
                const logEntries = sessionLogs.map((log, index) => {
                    // Generate consistent trace and span IDs for distributed tracing
                    // Use session-based trace ID for correlation across all calls in a session
                    // Must be 32-character lowercase hexadecimal strings for trace_id
                    // Must be 16-character lowercase hexadecimal strings for span_id

                    // Create a consistent trace ID based on session and user
                    const sessionString = `${sessionId}-${userId}`;
                    const traceId = this.simpleHash(sessionString).slice(0, 32);

                    // Create a span ID based on the specific call
                    const callString = `${log.id}-${log.procedure}-${index}`;
                    const spanId = this.simpleHash(callString).slice(0, 16);

                    // Include ALL possible information in the logs for maximum visibility
                    return {
                        message: `TRPC call: ${log.procedure} (${log.duration}ms)`,
                        service: 'zero-mail-app',
                        ddsource: 'trpc-logging',
                        ddtags: `session:${sessionId},user:${userId},procedure:${log.procedure},duration:${log.duration}ms,has_error:${!!log.error}`,
                        hostname: 'cloudflare-worker',
                        timestamp: log.timestamp,
                        // Trace correlation fields - must be nested in 'dd' object
                        // According to Datadog docs: https://docs.datadoghq.com/tracing/connect_logs_and_traces
                        dd: {
                            trace_id: traceId,
                            span_id: spanId,
                        },
                        // Environment and version for better correlation
                        env: 'development',
                        version: '1.0.0',
                        // Rich context at root level for better searchability and correlation
                        // Include ALL possible information for maximum visibility
                        procedure: log.procedure,
                        duration: log.duration,
                        session_id: sessionId,
                        user_id: userId,
                        call_id: log.id,
                        performance_category: log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow',
                        has_error: !!log.error,
                        error_message: log.error || null,
                        error_type: log.error ? 'trpc_error' : null,
                        // Additional context for better debugging
                        call_sequence: index + 1,
                        total_calls_in_session: sessionLogs.length,
                        session_start_time: sessionLogs[0]?.timestamp || log.timestamp,
                        session_duration: sessionLogs.length > 1 ? (sessionLogs[sessionLogs.length - 1]?.timestamp || log.timestamp) - (sessionLogs[0]?.timestamp || log.timestamp) : 0,
                        // HTTP context
                        http_method: 'POST',
                        http_url: `/api/trpc/${log.procedure}`,
                        // Request context (if available)
                        request_id: log.id,
                        request_timestamp: log.timestamp,
                        // Performance metrics
                        response_time_ms: log.duration,
                        response_time_category: log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow',
                        // Error details
                        error_details: log.error ? {
                            message: log.error,
                            type: 'trpc_error',
                            procedure: log.procedure,
                            timestamp: log.timestamp
                        } : null,
                        // Input/Output data (truncated for safety)
                        input_data: log.input ? (typeof log.input === 'string' ? log.input.slice(0, 1000) : JSON.stringify(log.input).slice(0, 1000)) : null,
                        output_data: log.output ? (typeof log.output === 'string' ? log.output.slice(0, 1000) : JSON.stringify(log.output).slice(0, 1000)) : null,
                        // Metadata
                        metadata: {
                            session_id: sessionId,
                            user_id: userId,
                            call_id: log.id,
                            procedure: log.procedure,
                            duration: log.duration,
                            timestamp: log.timestamp,
                            has_error: !!log.error,
                            error_message: log.error || null,
                            call_sequence: index + 1,
                            total_calls_in_session: sessionLogs.length,
                            performance_category: log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow',
                        }
                    };
                });

                allLogEntries.push(...logEntries);
            }

            console.log('📊 Sending batch to Datadog:', {
                sessionCount: logs.length,
                totalLogCount: allLogEntries.length,
                sessions: logs.map(l => ({ sessionId: l.sessionId, userId: l.userId, logCount: l.logs.length }))
            });

            if (allLogEntries.length > 0) {
                const logParams: v2.LogsApiSubmitLogRequest = {
                    body: allLogEntries,
                };

                await this.apiInstance.submitLog(logParams);
            }
        } catch (error) {
            console.error('Failed to export batch logs to Datadog:', error);
        }
    }
} 