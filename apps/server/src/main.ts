import { MainWorkflow, ThreadWorkflow, ZeroWorkflow } from './pipelines';
import { env, WorkerEntrypoint } from 'cloudflare:workers';
import { EProviders, type ISubscribeBatch } from './types';
import { contextStorage } from 'hono/context-storage';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { routePartykitRequest } from 'partyserver';
import { enableBrainFunction } from './lib/brain';
import { verifyToken } from './lib/server-utils';
import { trpcServer } from '@hono/trpc-server';
import { agentsMiddleware } from 'hono-agents';
import { DurableMailbox } from './lib/party';
import { autumnApi } from './routes/autumn';
import { ZeroAgent } from './routes/chat';
import type { HonoContext } from './ctx';
import { ZeroMCP } from './routes/chat';
import { createAuth } from './lib/auth';
import { aiRouter } from './routes/ai';
import { Autumn } from 'autumn-js';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { createDb } from './db';
import { Hono } from 'hono';

const api = new Hono<HonoContext>()
  .use(contextStorage())
  .use('*', async (c, next) => {
    const db = createDb(env.HYPERDRIVE.connectionString);
    c.set('db', db);
    const auth = createAuth();
    c.set('auth', auth);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('sessionUser', session?.user);

    // Bearer token if no session user yet
    if (c.req.header('Authorization') && !session?.user) {
      const token = c.req.header('Authorization')?.split(' ')[1];

      if (token) {
        const localJwks = await auth.api.getJwks();
        const jwks = createLocalJWKSet(localJwks);

        const { payload } = await jwtVerify(token, jwks);
        const userId = payload.sub;

        if (userId) {
          c.set(
            'sessionUser',
            await db.query.user.findFirst({
              where: (user, ops) => {
                return ops.eq(user.id, userId);
              },
            }),
          );
        }
      }
    }

    const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
    c.set('autumn', autumn);
    await next();
  })
  .route('/ai', aiRouter)
  .route('/autumn', autumnApi)
  .on(['GET', 'POST'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))
  .use(
    trpcServer({
      endpoint: '/api/trpc',
      router: appRouter,
      createContext: (_, c) => {
        return { c, sessionUser: c.var['sessionUser'], db: c.var['db'] };
      },
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
  .get('/', (c) => c.redirect(`${env.VITE_PUBLIC_APP_URL}`))
  .post('/a8n/notify/:providerId', async (c) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, { status: 401 });
    const providerId = c.req.param('providerId');
    if (providerId === EProviders.google) {
      const body = await c.req.json<{ historyId: string }>();
      const subHeader = c.req.header('x-goog-pubsub-subscription-name');
      const isValid = await verifyToken(c.req.header('Authorization')!.split(' ')[1]);
      if (!isValid) {
        console.log('[GOOGLE] invalid request', body);
        return c.json({}, { status: 200 });
      }
      const instance = await env.MAIN_WORKFLOW.create({
        params: {
          providerId,
          historyId: body.historyId,
          subscriptionName: subHeader,
        },
      });
      console.log('[GOOGLE] created instance', instance.id, instance.status);
      return c.json({ message: 'OK' }, { status: 200 });
    }
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

  async queue(batch: MessageBatch<ISubscribeBatch>) {
    switch (batch.queue) {
      case 'subscribe-queue': {
        console.log('batch', batch);
        try {
          await Promise.all(
            batch.messages.map(async (msg) => {
              const connectionId = msg.body.connectionId;
              const providerId = msg.body.providerId;
              console.log('connectionId', connectionId);
              console.log('providerId', providerId);
              try {
                await enableBrainFunction({ id: connectionId, providerId });
              } catch (error) {
                console.error(`Failed to enable brain function for connection ${connectionId}:`, error);
              }
            }),
          );
          console.log('batch done');
        } finally {
          batch.ackAll();
        }
        return;
      }
    }
  }

  async scheduled() {
    console.log('Checking for expired subscriptions...');
    const allAccounts = await env.subscribed_accounts.list();
    console.log('allAccounts', allAccounts.keys);
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const expiredSubscriptions: Array<{ connectionId: string; providerId: EProviders }> = [];

    await Promise.all(
      allAccounts.keys.map(async (key) => {
        const [connectionId, providerId] = key.name.split('__');
        const lastSubscribed = await env.gmail_sub_age.get(key.name);

        if (lastSubscribed) {
          const subscriptionDate = new Date(lastSubscribed);
          if (subscriptionDate < fiveDaysAgo) {
            console.log(`Found expired Google subscription for connection: ${connectionId}`);
            expiredSubscriptions.push({ connectionId, providerId: providerId as EProviders });
          }
        }
      }),
    );

    // Send expired subscriptions to queue for renewal
    if (expiredSubscriptions.length > 0) {
      console.log(`Sending ${expiredSubscriptions.length} expired subscriptions to renewal queue`);
      await Promise.all(
        expiredSubscriptions.map(async ({ connectionId, providerId }) => {
          await env.subscribe_queue.send({ connectionId, providerId });
        }),
      );
    }

    console.log(
      `Processed ${allAccounts.keys.length} accounts, found ${expiredSubscriptions.length} expired subscriptions`,
    );
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

export { DurableMailbox, ZeroAgent, ZeroMCP, MainWorkflow, ZeroWorkflow, ThreadWorkflow };
