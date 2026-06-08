import { client, v2 } from '@datadog/datadog-api-client';
import type { TRPCCallLog } from '../types/logging';
import type { ZeroEnv } from '../env';

export class DatadogService {
  private apiInstance?: v2.LogsApi;
  readonly enabled: boolean;

  constructor(env?: ZeroEnv) {
    const apiKey = env?.DD_API_KEY?.trim();
    if (!apiKey) {
      this.enabled = false;
      return;
    }

    const configuration = client.createConfiguration({
      authMethods: {
        apiKeyAuth: apiKey,
        appKeyAuth: env?.DD_APP_KEY?.trim() || '',
      },
    });

    const ddSite = env?.DD_SITE?.trim() || 'datadoghq.com';
    configuration.setServerVariables({ site: ddSite });

    this.apiInstance = new v2.LogsApi(configuration);
    this.enabled = true;
  }

  private generateId(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

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
    if (!this.enabled || !this.apiInstance || this.isLoggingProcedure(log.procedure)) {
      return;
    }

    try {
      const traceId = this.generateId();
      const spanId = this.generateId();

      const performanceCategory = log.duration < 100 ? 'fast' : log.duration < 500 ? 'normal' : 'slow';
      const hasError = !!log.error;
      const logLevel = hasError ? 'error' : performanceCategory === 'slow' ? 'warn' : 'info';

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

        let browser = 'unknown';
        let browserVersion = '';
        let operatingSystem = 'unknown';
        let osVersion = '';
        let deviceType = 'unknown';

        for (const [name, regex] of Object.entries(browsers)) {
          const match = userAgent.match(regex);
          if (match) {
            browser = name;
            browserVersion = match[1];
            break;
          }
        }

        for (const [name, regex] of Object.entries(os)) {
          const match = userAgent.match(regex);
          if (match) {
            operatingSystem = name;
            osVersion = match[1]?.replace(/_/g, '.') || '';
            break;
          }
        }

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
        dd: {
          trace_id: traceId,
          span_id: spanId,
        },
        additionalProperties: {
          call_id: log.id,
          procedure: log.procedure,
          duration: log.duration,
          performance_category: performanceCategory,
          trpc_method: log.metadata?.method || 'unknown',
          session_id: sessionId,
          user_id: userId,
          http_method: 'POST',
          http_url: `/api/trpc/${log.procedure}`,
          client_ip: log.metadata?.ip,
          referer: log.metadata?.referer,
          origin: log.metadata?.origin,
          accept_language: log.metadata?.acceptLanguage,
          accept_encoding: log.metadata?.acceptEncoding,
          request_id: log.metadata?.requestId,
          ...deviceInfo,
          has_error: hasError,
          ...(log.error && {
            error_message: log.error,
            error_type: 'trpc_error',
          }),
          request_payload: log.input,
          ...(log.output && {
            response_payload: log.output,
          }),
          timing: {
            start_time: log.metadata?.startTime || log.timestamp,
            end_time: log.metadata?.endTime || log.timestamp + log.duration,
            duration_ms: log.duration,
            performance_category: performanceCategory,
          },
          trace: log.trace,
        },
      };

      await this.apiInstance.submitLog({ body: [logEntry] });
    } catch (error) {
      console.error('Failed to log TRPC call to Datadog:', error);
    }
  }
}
