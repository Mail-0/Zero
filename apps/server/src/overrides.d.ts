declare namespace Cloudflare {
  declare interface Env {
    snoozed_emails: KVNamespace;
    unsnooze_queue: Queue;
    GRAFANA_ENDPOINT: string;
    GRAFANA_USERNAME: string;
    GRAFANA_PASSWORD: string;
    zero: Fetcher & {
      subscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
      unsubscribe: (data: { connectionId: string; providerId: string }) => Promise<void>;
    };
  }
}
