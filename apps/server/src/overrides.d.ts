declare namespace Cloudflare {
  declare interface Env {
    zero: Fetcher & {
      subscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
      unsubscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
    };
  }
}
