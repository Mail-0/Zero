import type { GmailPriority } from './gmail-quota-store';
import { AsyncLocalStorage } from 'node:async_hooks';

const priorities = new AsyncLocalStorage<GmailPriority>();
export function gmailPriority(): GmailPriority {
  return priorities.getStore() ?? 'foreground';
}
export function withGmailPriority<T>(priority: GmailPriority, work: () => T): T {
  return priorities.run(priority, work);
}
