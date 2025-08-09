import { trace, type Tracer, type Attributes } from '@opentelemetry/api';

export const initTracing = (): Tracer => {
  return trace.getTracer('zero-email-server', '1.0.0');
};

export const createSpan = (tracer: Tracer, name: string, attributes?: Attributes) => {
  return tracer.startSpan(name, { attributes });
};
