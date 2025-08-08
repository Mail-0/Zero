import { client, v2 } from '@datadog/datadog-api-client';
import type { TRPCCallLog } from './logging-durable-object';
import type { ZeroEnv } from '../env';

export class DatadogService {
    private apiInstance: v2.LogsApi;

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
    }

    async exportSessionLogs(sessionId: string, userId: string, logs: TRPCCallLog[]): Promise<void> {
        if (logs.length === 0) return;

        try {
            const logEntries = logs.map(log => ({
                message: `TRPC call: ${log.procedure}`,
                service: 'zero-mail-app',
                ddsource: 'trpc-logging',
                ddtags: `session:${sessionId},user:${userId},procedure:${log.procedure}`,
                hostname: 'cloudflare-worker',
                timestamp: Date.now(),
                // Custom fields for TRPC data
                trpc: {
                    procedure: log.procedure,
                    input: log.input,
                    output: log.output,
                    error: log.error,
                    duration: log.duration,
                    sessionId,
                    userId,
                },
            }));

            console.log('📊 Sending to Datadog:', {
                sessionId,
                userId,
                logCount: logs.length,
                // logEntries: logEntries
            });

            const params = {
                body: logEntries,
            };

            await this.apiInstance.submitLog(params);

            console.log('✅ Successfully exported to Datadog:', {
                sessionId,
                userId,
                logCount: logs.length
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
                const logEntries = sessionLogs.map(log => ({
                    message: `TRPC call: ${log.procedure}`,
                    service: 'zero-mail-app',
                    ddsource: 'trpc-logging',
                    ddtags: `session:${sessionId},user:${userId},procedure:${log.procedure}`,
                    hostname: 'cloudflare-worker',
                    timestamp: Date.now(),
                    trpc: {
                        procedure: log.procedure,
                        input: log.input,
                        output: log.output,
                        error: log.error,
                        duration: log.duration,
                        sessionId,
                        userId,
                    },
                }));

                allLogEntries.push(...logEntries);
            }

            console.log('📊 Sending batch to Datadog:', {
                sessionCount: logs.length,
                totalLogCount: allLogEntries.length,
                sessions: logs.map(l => ({ sessionId: l.sessionId, userId: l.userId, logCount: l.logs.length }))
            });

            if (allLogEntries.length > 0) {
                const params = {
                    body: allLogEntries,
                };

                await this.apiInstance.submitLog(params);
            }
        } catch (error) {
            console.error('Failed to export batch logs to Datadog:', error);
        }
    }
} 