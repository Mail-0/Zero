declare namespace Cloudflare {
  declare interface Env {
    snoozed_emails: KVNamespace;
    unsnooze_queue: Queue;
    zero: Fetcher & {
      subscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
      unsubscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
    };
  }
}
