import { register, Counter, Histogram } from 'prom-client';
import { env } from 'cloudflare:workers';

export const trpcRequestDuration = new Histogram({
  name: 'trpc_request_duration_seconds',
  help: 'Duration of tRPC requests in seconds',
  labelNames: ['procedure', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const trpcRequestTotal = new Counter({
  name: 'trpc_requests_total',
  help: 'Total number of tRPC requests',
  labelNames: ['procedure', 'status'],
});

export const zeroAgentOperationDuration = new Histogram({
  name: 'zero_agent_operation_duration_seconds',
  help: 'Duration of ZeroAgent operations in seconds',
  labelNames: ['operation', 'connection_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const zeroDriverOperationDuration = new Histogram({
  name: 'zero_driver_operation_duration_seconds',
  help: 'Duration of ZeroDriver operations in seconds',
  labelNames: ['operation', 'connection_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const emailOperationTotal = new Counter({
  name: 'email_operations_total',
  help: 'Total number of email operations',
  labelNames: ['operation', 'provider', 'status'],
});

export class MetricsCollector {
  private static instance: MetricsCollector;
  private lastSent = Date.now();
  private readonly batchInterval = 30000;

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  async collectAndSend(): Promise<void> {
    if (!this.shouldSendMetrics()) return;

    try {
      const metrics = await register.metrics();
      await this.sendToGrafana(metrics);
      this.lastSent = Date.now();
    } catch (error) {
      console.error('Failed to send metrics to Grafana:', error);
    }
  }

  private shouldSendMetrics(): boolean {
    return (
      env.GRAFANA_ENDPOINT &&
      env.GRAFANA_USERNAME &&
      env.GRAFANA_PASSWORD &&
      Date.now() - this.lastSent > this.batchInterval
    );
  }

  private async sendToGrafana(metrics: string): Promise<void> {
    const auth = btoa(`${env.GRAFANA_USERNAME}:${env.GRAFANA_PASSWORD}`);
    
    await fetch(env.GRAFANA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-protobuf',
        'Content-Encoding': 'snappy',
        'X-Prometheus-Remote-Write-Version': '0.1.0',
        'Authorization': `Basic ${auth}`,
      },
      body: metrics,
    });
  }
}

export function timeOperation<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  operation: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  return operation().finally(() => end());
}
