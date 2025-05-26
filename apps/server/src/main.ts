import { env, WorkerEntrypoint } from 'cloudflare:workers';
import { contextStorage } from 'hono/context-storage';
import { ZeroAgent, ZeroMCP } from './routes/chat';
import { routePartykitRequest } from 'partyserver';
import { trpcServer } from '@hono/trpc-server';
import { agentsMiddleware } from 'hono-agents';
import { DurableMailbox } from './lib/party';
import { autumnApi } from './routes/autumn';
import type { HonoContext } from './ctx';
import { createAuth } from './lib/auth';
import { createDb } from '@zero/db';
import { Autumn } from 'autumn-js';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

const api = new Hono<HonoContext>()
  .use(contextStorage())
  .use('*', async (c, next) => {
    const db = createDb(env.HYPERDRIVE.connectionString);
    c.set('db', db);
    const auth = createAuth();
    c.set('auth', auth);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('session', session);
    const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
    c.set('autumn', autumn);
    await next();
  })
  .route('/autumn', autumnApi)
  .on(['GET', 'POST'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))
  .use(
    trpcServer({
      endpoint: '/api/trpc',
      router: appRouter,
      createContext: (_, c) => ({ c, session: c.var['session'], db: c.var['db'] }),
      allowMethodOverride: true,
      onError: (opts) => {
        console.error('Error in TRPC handler:', opts.error);
      },
    }),
  )
  .onError(async (err, c) => {
    if (err instanceof Response) return err;
    console.error('Error in Hono handler:', err);
    return c.json(
      {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  });

const app = new Hono<HonoContext>()
  .use(
    '*',
    cors({
      origin: (c) => {
        if (c.includes(env.COOKIE_DOMAIN)) {
          return c;
        } else {
          return null;
        }
      },
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-Zero-Redirect'],
    }),
  )
  .mount(
    '/sse',
    async (request, env, ctx) => {
      const authBearer = request.headers.get('Authorization');
      if (!authBearer) {
        return new Response('Unauthorized', { status: 401 });
      }
      ctx.props = {
        cookie: authBearer,
      };
      return ZeroMCP.serveSSE('/sse', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
    },
    { replaceRequest: false },
  )
  .mount(
    '/mcp',
    async (request, env, ctx) => {
      const authBearer = request.headers.get('Authorization');
      if (!authBearer) {
        return new Response('Unauthorized', { status: 401 });
      }
      ctx.props = {
        cookie: authBearer,
      };
      return ZeroMCP.serve('/mcp', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
    },
    { replaceRequest: false },
  )
  .route('/api', api)
  .use(
    '*',
    agentsMiddleware({
      options: {
        onBeforeConnect: (c) => {
          if (!c.headers.get('Cookie')) {
            return new Response('Unauthorized', { status: 401 });
          }
        },
      },
    }),
  )
  .get('/health', (c) => c.json({ message: 'Zero Server is Up!' }))
  .get('/', (c) => c.redirect(`${env.VITE_PUBLIC_APP_URL}`));

export default class extends WorkerEntrypoint<typeof env> {
  async fetch(request: Request): Promise<Response> {
    if (request.url.includes('/zero/durable-mailbox')) {
      const res = await routePartykitRequest(request, env as unknown as Record<string, unknown>, {
        prefix: 'zero',
      });
      if (res) return res;
    }
    return app.fetch(request, this.env, this.ctx);
  }

  public async notifyUser({
    connectionId,
    threadIds,
    type,
  }: {
    connectionId: string;
    threadIds: string[];
    type: 'refresh' | 'list';
  }) {
    console.log(`Notifying user ${connectionId} for threads ${threadIds} with type ${type}`);
    const durableObject = env.DURABLE_MAILBOX.idFromName(`${connectionId}`);
    if (env.DURABLE_MAILBOX.get(durableObject)) {
      const stub = env.DURABLE_MAILBOX.get(durableObject);
      if (stub) {
        console.log(`Broadcasting message for thread ${threadIds} with type ${type}`);
        await stub.broadcast(JSON.stringify({ threadIds, type }));
        console.log(`Successfully broadcasted message for thread ${threadIds}`);
      } else {
        console.log(`No stub found for connection ${connectionId}`);
      }
    } else {
      console.log(`No durable object found for connection ${connectionId}`);
    }
  }
}

export { DurableMailbox, ZeroAgent, ZeroMCP };
