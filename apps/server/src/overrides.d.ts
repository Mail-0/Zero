declare namespace Cloudflare {
  declare interface Env {
    snoozed_emails: KVNamespace;
    zero: Fetcher & {
      subscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
      unsubscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
    };
  }
}
