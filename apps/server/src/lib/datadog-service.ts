import { client, v2 } from '@datadog/datadog-api-client';
import type { TRPCCallLog } from '../types/logging';
import type { ZeroEnv } from '../env';

export class DatadogService {
    private apiInstance: v2.LogsApi;
    private apiKey: string;
    private appKey: string;
    private site: string;

    constructor(env?: ZeroEnv) {
        // Runtime validation for required Datadog credentials
        if (!env?.DD_API_KEY || env.DD_API_KEY.trim() === '') {
            throw new Error('DD_API_KEY environment variable is required and cannot be empty for Datadog service');
        }

        if (!env?.DD_APP_KEY || env.DD_APP_KEY.trim() === '') {
            throw new Error('DD_APP_KEY environment variable is required and cannot be empty for Datadog service');
        }

        const configuration = client.createConfiguration({
            authMethods: {
                apiKeyAuth: env.DD_API_KEY,
                appKeyAuth: env.DD_APP_KEY,
            },
        });

        // Set the site for the configuration (defaults to datadoghq.com if not provided)
        const ddSite = env?.DD_SITE || 'datadoghq.com';
        configuration.setServerVariables({ site: ddSite });

        this.apiInstance = new v2.LogsApi(configuration);
        this.apiKey = env.DD_API_KEY;
        this.appKey = env.DD_APP_KEY;
        this.site = ddSite;
    }

    private generateId(): string {
        return crypto.randomUUID().replace(/-/g, '');
    }

    // Check if a procedure is logging-related to avoid recursive logging
    private isLoggingProcedure(procedure: string): boolean {
        const loggingProcedures = [
            'logging.getSessionStats',
            'logging.clearSession',
            'logging.getSessionState',
            'logging.exportToDatadog',
        ];
        return loggingProcedures.includes(procedure);
    }

    async logSingleCall(sessionId: string, userId: string, log: TRPCCallLog): Promise<void> {
        // Skip logging-related procedures to avoid recursive logging
        if (this.isLoggingProcedure(log.procedure)) {
            return;
        }

        try {
            const traceId = this.generateId();
            const spanId = this.generateId();

            const performanceCategory = log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow';
            const hasError = !!log.error;
            const logLevel = hasError ? 'error' : performanceCategory === 'slow' ? 'warn' : 'info';

            // Parse user agent for device/browser info
            const parseUserAgent = (userAgent?: string) => {
                if (!userAgent) return {};

                const browsers = {
                    chrome: /Chrome\/([0-9.]+)/i,
                    firefox: /Firefox\/([0-9.]+)/i,
                    safari: /Safari\/([0-9.]+)/i,
                    edge: /Edg\/([0-9.]+)/i,
                };

                const os = {
                    windows: /Windows NT ([0-9.]+)/i,
                    macos: /Mac OS X ([0-9_.]+)/i,
                    linux: /Linux/i,
                    android: /Android ([0-9.]+)/i,
                    ios: /OS ([0-9_]+)/i,
                };

                const devices = {
                    mobile: /Mobile|Android|iPhone/i,
                    tablet: /iPad|Tablet/i,
                    desktop: /Windows|Mac|Linux/i,
                };

                let browser = 'unknown', browserVersion = '', operatingSystem = 'unknown', osVersion = '', deviceType = 'unknown';

                // Detect browser
                for (const [name, regex] of Object.entries(browsers)) {
                    const match = userAgent.match(regex);
                    if (match) {
                        browser = name;
                        browserVersion = match[1];
                        break;
                    }
                }

                // Detect OS
                for (const [name, regex] of Object.entries(os)) {
                    const match = userAgent.match(regex);
                    if (match) {
                        operatingSystem = name;
                        osVersion = match[1]?.replace(/_/g, '.') || '';
                        break;
                    }
                }

                // Detect device type
                for (const [type, regex] of Object.entries(devices)) {
                    if (regex.test(userAgent)) {
                        deviceType = type;
                        break;
                    }
                }

                return {
                    browser,
                    browser_version: browserVersion,
                    operating_system: operatingSystem,
                    os_version: osVersion,
                    device_type: deviceType,
                    user_agent: userAgent,
                };
            };

            const deviceInfo = parseUserAgent(log.metadata?.userAgent);

            const logEntry = {
                message: `${logLevel.toUpperCase()}: TRPC call: [${log.procedure}] (${log.duration}ms)`,
                status: logLevel,
                service: 'zero-mail-app',
                ddsource: 'trpc-logging',
                ddtags: `session:${sessionId},user:${userId},procedure:${log.procedure},duration:${log.duration}ms,has_error:${hasError},performance:${performanceCategory},browser:${deviceInfo.browser},device:${deviceInfo.device_type}`,
                hostname: 'cloudflare-worker',
                timestamp: log.timestamp,

                // Trace correlation fields
                dd: {
                    trace_id: traceId,
                    span_id: spanId,
                },

                additionalProperties: {
                    // Core call data
                    call_id: log.id,
                    procedure: log.procedure,
                    duration: log.duration,
                    performance_category: performanceCategory,
                    trpc_method: log.metadata?.method || 'unknown',

                    // Session context
                    session_id: sessionId,
                    user_id: userId,

                    // HTTP context
                    http_method: 'POST',
                    http_url: `/api/trpc/${log.procedure}`,
                    client_ip: log.metadata?.ip,
                    referer: log.metadata?.referer,
                    origin: log.metadata?.origin,
                    accept_language: log.metadata?.acceptLanguage,
                    accept_encoding: log.metadata?.acceptEncoding,
                    request_id: log.metadata?.requestId,

                    // Device and browser information
                    ...deviceInfo,

                    // Error handling
                    has_error: hasError,
                    ...(log.error && {
                        error_message: log.error,
                        error_type: 'trpc_error',
                    }),

                    // Full request/response data
                    request_payload: log.input,
                    ...(log.output && {
                        response_payload: log.output,
                    }),

                    // Performance metrics
                    timing: {
                        start_time: log.metadata?.startTime || log.timestamp,
                        end_time: log.metadata?.endTime || (log.timestamp + log.duration),
                        duration_ms: log.duration,
                        performance_category: performanceCategory,
                    },

                    // Complete request trace with all spans (from log.trace)
                    trace: log.trace,
                }
            };

            await this.apiInstance.submitLog({ body: [logEntry] });

        } catch (error) {
            console.error('❌ Failed to log TRPC call to Datadog:', error);
        }
    }
} 