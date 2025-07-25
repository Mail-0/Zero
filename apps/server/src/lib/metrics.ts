import { Counter, Histogram } from 'prom-client';

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

export function timeOperation<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  operation: () => Promise<T>,
): Promise<T> {
  const end = histogram.startTimer(labels);
  return operation().finally(() => end());
}
