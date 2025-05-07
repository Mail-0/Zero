import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { mailtoHandler } from '../mailto-handler';
import type { HonoVariables } from '@/trpc/hono';
import { chatHandler } from '../chat';
import { appRouter } from '@/trpc';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';
import { Hono } from 'hono';

const api = new Hono<{ Variables: HonoVariables }>()
  .basePath('/api')
  .use('*', async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('session', session);
    c.set('db', db);
    await next();
  })
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .all('/trpc/*', (c) =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: () => ({ c, session: c.var.session, db: c.var.db }),
      allowMethodOverride: true,
      onError: (opts) => {
        console.error('Error in TRPC handler:', opts.error);
      },
    }),
  )
  .post('/chat', async (c) => chatHandler(c))
  .get('/mailto-handler', async (c) => mailtoHandler(c))
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
const handler = (req: Request) => api.request(req);

export {
  handler as GET,
  handler as POST,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
