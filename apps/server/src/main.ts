import { mailtoHandler } from './routes/mailto-handler';
import type { HonoContext, HonoVariables } from './ctx';
import { trpcServer } from '@hono/trpc-server';
import { chatHandler } from './routes/chat';
import { env } from 'cloudflare:workers';
import { createAuth } from './lib/auth';
import { createDb } from '@zero/db';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

const api = new Hono<{ Variables: HonoVariables; Bindings: Env }>()
  .use(
    '*',
    cors({
      origin: (_, c: HonoContext) => c.env.NEXT_PUBLIC_APP_URL,
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  .use('*', async (c, next) => {
    const db = createDb(env.HYPERDRIVE.connectionString);
    c.set('db', db);
    const auth = createAuth(c);
    c.set('auth', auth);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('session', session);
    await next();
  })
  .post('/chat', async (c) => chatHandler(c))
  .get('/mailto-handler', async (c) => mailtoHandler(c))
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

const app = new Hono()
  .get('/', (c) => c.json({ message: 'Zero Server is Up!' }))
  .get('/mail/inbox', (c) => c.redirect(env.NEXT_PUBLIC_APP_URL))
  .route('/api', api);

export default app;
