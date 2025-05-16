import { env, WorkerEntrypoint } from 'cloudflare:workers';
import { mailtoHandler } from './routes/mailto-handler';
import { contextStorage } from 'hono/context-storage';
import { routePartykitRequest } from 'partyserver';
import { trpcServer } from '@hono/trpc-server';
import { DurableMailbox } from './lib/party';
import { chatHandler } from './routes/chat';
import type { HonoContext } from './ctx';
import { createAuth } from './lib/auth';
import { createDb } from '@zero/db';
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
    await next();
  })
  .post('/chat', chatHandler)
  .get('/mailto-handler', mailtoHandler)
  .on(['GET', 'POST'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))
  .use(
    trpcServer({
      endpoint: '/api/trpc',
      router: appRouter,
      createContext: (_, c) => ({ c, session: c.var.session, db: c.var.db }),
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
      origin: () => env.NEXT_PUBLIC_APP_URL,
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-Zero-Redirect'],
    }),
  )
  .route('/api', api)
  .get('/health', (c) => c.json({ message: 'Zero Server is Up!' }))
  .get('/', (c) => {
    return c.redirect(`${env.NEXT_PUBLIC_APP_URL}`);
  });

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
    threadId,
    type,
  }: {
    connectionId: string;
    threadId: string;
    type: 'start' | 'end';
  }) {
    console.log(`Notifying user ${connectionId} for thread ${threadId} with type ${type}`);
    const durableObject = env.DURABLE_MAILBOX.idFromName(`${connectionId}`);
    if (env.DURABLE_MAILBOX.get(durableObject)) {
      const stub = env.DURABLE_MAILBOX.get(durableObject);
      if (stub) {
        console.log(`Broadcasting message for thread ${threadId} with type ${type}`);
        await stub.broadcast(threadId + ':' + type);
        console.log(`Successfully broadcasted message for thread ${threadId}`);
      } else {
        console.log(`No stub found for connection ${connectionId}`);
      }
    } else {
      console.log(`No durable object found for connection ${connectionId}`);
    }
  }
}

export { DurableMailbox };
