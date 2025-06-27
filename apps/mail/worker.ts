import { createRequestHandler } from 'react-router';

declare global {
  interface CloudflareEnvironment extends Env {}
}

declare module 'react-router' {
  export interface AppLoadContext {
    cloudflare: {
      env: CloudflareEnvironment;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  // @ts-ignore, virtual module
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

const sentryUrl = `https://o4509328786915328.ingest.us.sentry.io/api/4509328795303936/envelope/?sentry_version=7&sentry_key=03f6397c0eb458bf1e37c4776a31797c&sentry_client=sentry.javascript.react%2F9.19.0`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/monitoring')) {
      const sentryRequest = new Request(sentryUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      return await fetch(sentryRequest);
    }
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
