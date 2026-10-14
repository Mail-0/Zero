import type { QuotaDecision } from './gmail-quota-store';
import { Cause, Option, Runtime } from 'effect';

export class GmailQuotaDeferredError extends Error {
  readonly quotaDeferred = true;
  constructor(
    readonly retryAt: number,
    readonly scope: 'project' | 'mailbox',
  ) {
    super(`Gmail ${scope} quota capacity is temporarily unavailable`);
    this.name = 'GmailQuotaDeferredError';
  }
  static from(decision: Exclude<QuotaDecision, { allowed: true }>) {
    return new GmailQuotaDeferredError(decision.retryAt, decision.scope);
  }
}

export function unwrapGmailError(error: unknown): unknown {
  let current = error;
  for (let i = 0; i < 10; i++) {
    if (Runtime.isFiberFailure(current)) {
      const failure = Cause.failureOption(current[Runtime.FiberFailureCauseId]);
      if (Option.isSome(failure)) {
        current = failure.value;
        continue;
      }
    }
    if (!current || typeof current !== 'object') break;
    const wrapper = current as {
      originalError?: unknown;
      cause?: unknown;
      error?: unknown;
      _tag?: string;
    };
    if (wrapper.originalError) {
      current = wrapper.originalError;
      continue;
    }
    if (wrapper.error && wrapper._tag?.endsWith('Failed')) {
      current = wrapper.error;
      continue;
    }
    if (wrapper.cause && ['UnknownException', 'ThreadDataError'].includes(wrapper._tag ?? '')) {
      current = wrapper.cause;
      continue;
    }
    break;
  }
  return current;
}
