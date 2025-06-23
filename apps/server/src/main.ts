import {
  createUpdatedMatrixFromNewEmail,
  initializeStyleMatrixFromEmail,
  type EmailMatrix,
  type WritingStyleMatrix,
} from './services/writing-style-service';
import {
  account,
  connection,
  note,
  session,
  user,
  userHotkeys,
  userSettings,
  writingStyleMatrix,
} from './db/schema';
import { env, WorkerEntrypoint, DurableObject } from 'cloudflare:workers';
import { MainWorkflow, ThreadWorkflow, ZeroWorkflow } from './pipelines';
import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { getZeroDB, verifyToken } from './lib/server-utils';
import { EProviders, type ISubscribeBatch } from './types';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { contextStorage } from 'hono/context-storage';
import { defaultUserSettings } from './lib/schemas';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { routePartykitRequest } from 'partyserver';
import { withMcpAuth } from 'better-auth/plugins';
import { enableBrainFunction } from './lib/brain';
import { trpcServer } from '@hono/trpc-server';
import { agentsMiddleware } from 'hono-agents';
import { publicRouter } from './routes/auth';
import { DurableMailbox } from './lib/party';
import { autumnApi } from './routes/autumn';
import { ZeroAgent } from './routes/chat';
import type { HonoContext } from './ctx';
import { createDb, type DB } from './db';
import { ZeroMCP } from './routes/chat';
import { createAuth } from './lib/auth';
import { aiRouter } from './routes/ai';
import { Autumn } from 'autumn-js';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

class ZeroDB extends DurableObject {
  db: DB = createDb(env.HYPERDRIVE.connectionString);

  async findUser(userId: string): Promise<typeof user.$inferSelect | undefined> {
    return await this.db.query.user.findFirst({
      where: eq(user.id, userId),
    });
  }

  async findUserConnection(
    userId: string,
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: and(eq(connection.userId, userId), eq(connection.id, connectionId)),
    });
  }

  async updateUser(userId: string, data: Partial<typeof user.$inferInsert>) {
    return await this.db.update(user).set(data).where(eq(user.id, userId));
  }

  async deleteConnection(connectionId: string, userId: string) {
    return await this.db
      .delete(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)));
  }

  async findFirstConnection(userId: string): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: eq(connection.userId, userId),
    });
  }

  async findManyConnections(userId: string): Promise<(typeof connection.$inferSelect)[]> {
    return await this.db.query.connection.findMany({
      where: eq(connection.userId, userId),
    });
  }

  async findManyNotesByThreadId(
    userId: string,
    threadId: string,
  ): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, userId), eq(note.threadId, threadId)),
      orderBy: [desc(note.isPinned), asc(note.order), desc(note.createdAt)],
    });
  }

  async createNote(userId: string, payload: typeof note.$inferInsert) {
    return await this.db.insert(note).values({
      ...payload,
      userId,
    });
  }

  async updateNote(
    userId: string,
    noteId: string,
    payload: Partial<typeof note.$inferInsert>,
  ): Promise<typeof note.$inferSelect | undefined> {
    const [updated] = await this.db
      .update(note)
      .set(payload)
      .where(and(eq(note.id, noteId), eq(note.userId, userId)))
      .returning();
    return updated;
  }

  async updateManyNotes(
    userId: string,
    notes: { id: string; order: number; isPinned?: boolean | null }[],
  ): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      for (const n of notes) {
        const updateData: Record<string, unknown> = {
          order: n.order,
          updatedAt: new Date(),
        };

        if (n.isPinned !== undefined) {
          updateData.isPinned = n.isPinned;
        }
        await tx
          .update(note)
          .set(updateData)
          .where(and(eq(note.id, n.id), eq(note.userId, userId)));
      }
      return true;
    });
  }

  async findManyNotesByIds(
    userId: string,
    noteIds: string[],
  ): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, userId), inArray(note.id, noteIds)),
    });
  }

  async deleteNote(userId: string, noteId: string) {
    return await this.db.delete(note).where(and(eq(note.id, noteId), eq(note.userId, userId)));
  }

  async findNoteById(
    userId: string,
    noteId: string,
  ): Promise<typeof note.$inferSelect | undefined> {
    return await this.db.query.note.findFirst({
      where: and(eq(note.id, noteId), eq(note.userId, userId)),
    });
  }

  async findHighestNoteOrder(userId: string): Promise<{ order: number } | undefined> {
    return await this.db.query.note.findFirst({
      where: eq(note.userId, userId),
      orderBy: desc(note.order),
      columns: { order: true },
    });
  }

  async deleteUser(userId: string) {
    return await this.db.transaction(async (tx) => {
      await tx.delete(connection).where(eq(connection.userId, userId));
      await tx.delete(account).where(eq(account.userId, userId));
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(userSettings).where(eq(userSettings.userId, userId));
      await tx.delete(user).where(eq(user.id, userId));
      await tx.delete(userHotkeys).where(eq(userHotkeys.userId, userId));
    });
  }

  async findUserSettings(userId: string): Promise<typeof userSettings.$inferSelect | undefined> {
    return await this.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });
  }

  async findUserHotkeys(userId: string): Promise<(typeof userHotkeys.$inferSelect)[]> {
    return await this.db.query.userHotkeys.findMany({
      where: eq(userHotkeys.userId, userId),
    });
  }

  async insertUserHotkeys(userId: string, shortcuts: (typeof userHotkeys.$inferInsert)[]) {
    return await this.db
      .insert(userHotkeys)
      .values({
        userId,
        shortcuts,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userHotkeys.userId,
        set: {
          shortcuts,
          updatedAt: new Date(),
        },
      });
  }

  async insertUserSettings(userId: string, settings: typeof defaultUserSettings) {
    return await this.db.insert(userSettings).values({
      id: crypto.randomUUID(),
      userId,
      settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateUserSettings(userId: string, settings: typeof defaultUserSettings) {
    return await this.db
      .insert(userSettings)
      .values({
        id: crypto.randomUUID(),
        userId,
        settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          settings,
          updatedAt: new Date(),
        },
      });
  }

  async createConnection(
    providerId: EProviders,
    email: string,
    userId: string,
    updatingInfo: {
      expiresAt: Date;
      scope: string;
    },
  ): Promise<{ id: string }[]> {
    return await this.db
      .insert(connection)
      .values({
        ...updatingInfo,
        providerId,
        id: crypto.randomUUID(),
        email,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [connection.email, connection.userId],
        set: {
          ...updatingInfo,
          updatedAt: new Date(),
        },
      })
      .returning({ id: connection.id });
  }

  /**
   * @param connectionId Dangerous, use findUserConnection instead
   * @returns
   */
  async findConnectionById(
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: eq(connection.id, connectionId),
    });
  }

  async syncUserMatrix(connectionId: string, emailStyleMatrix: EmailMatrix) {
    await this.db.transaction(async (tx) => {
      const [existingMatrix] = await tx
        .select({
          numMessages: writingStyleMatrix.numMessages,
          style: writingStyleMatrix.style,
        })
        .from(writingStyleMatrix)
        .where(eq(writingStyleMatrix.connectionId, connectionId));

      if (existingMatrix) {
        const newStyle = createUpdatedMatrixFromNewEmail(
          existingMatrix.numMessages,
          existingMatrix.style as WritingStyleMatrix,
          emailStyleMatrix,
        );

        await tx
          .update(writingStyleMatrix)
          .set({
            numMessages: existingMatrix.numMessages + 1,
            style: newStyle,
          })
          .where(eq(writingStyleMatrix.connectionId, connectionId));
      } else {
        const newStyle = initializeStyleMatrixFromEmail(emailStyleMatrix);

        await tx
          .insert(writingStyleMatrix)
          .values({
            connectionId,
            numMessages: 1,
            style: newStyle,
          })
          .onConflictDoNothing();
      }
    });
  }

  async findWritingStyleMatrix(
    connectionId: string,
  ): Promise<typeof writingStyleMatrix.$inferSelect | undefined> {
    return await this.db.query.writingStyleMatrix.findFirst({
      where: eq(writingStyleMatrix.connectionId, connectionId),
      columns: {
        numMessages: true,
        style: true,
        updatedAt: true,
        connectionId: true,
      },
    });
  }

  async deleteActiveConnection(userId: string, connectionId: string) {
    return await this.db
      .delete(connection)
      .where(and(eq(connection.userId, userId), eq(connection.id, connectionId)));
  }

  async updateConnection(
    connectionId: string,
    updatingInfo: Partial<typeof connection.$inferInsert>,
  ) {
    return await this.db
      .update(connection)
      .set(updatingInfo)
      .where(eq(connection.id, connectionId));
  }
}

export default class extends WorkerEntrypoint<typeof env> {
  db: DB | undefined;
  private api = new Hono<HonoContext>()
    .use(contextStorage())
    .use('*', async (c, next) => {
      const auth = createAuth();
      c.set('auth', auth);
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      c.set('sessionUser', session?.user);

      if (c.req.header('Authorization') && !session?.user) {
        const token = c.req.header('Authorization')?.split(' ')[1];

        if (token) {
          const localJwks = await auth.api.getJwks();
          const jwks = createLocalJWKSet(localJwks);

          const { payload } = await jwtVerify(token, jwks);
          const userId = payload.sub;

          if (userId) {
            const db = getZeroDB(userId);
            c.set('sessionUser', await db.findUser(userId));
          }
        }
      }

      const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
      c.set('autumn', autumn);

      await next();

      c.set('sessionUser', undefined);
      c.set('autumn', undefined as any);
      c.set('auth', undefined as any);
    })
    .route('/ai', aiRouter)
    .route('/autumn', autumnApi)
    .route('/public', publicRouter)
    .on(['GET', 'POST', 'OPTIONS'], '/auth/*', (c) => {
      return c.var.auth.handler(c.req.raw);
    })
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

  private app = new Hono<HonoContext>()
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
    .get('.well-known/oauth-authorization-server', async (c) => {
      const auth = createAuth();
      return oAuthDiscoveryMetadata(auth)(c.req.raw);
    })
    .mount(
      '/sse',
      async (request, env, ctx) => {
        const authBearer = request.headers.get('Authorization');
        if (!authBearer) {
          return new Response('Unauthorized', { status: 401 });
        }
        const auth = createAuth();
        const session = await auth.api.getMcpSession({ headers: request.headers });
        if (!session) {
          return new Response('Unauthorized', { status: 401 });
        }
        ctx.props = {
          userId: session?.userId,
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
        const auth = createAuth();
        const session = await auth.api.getMcpSession({ headers: request.headers });
        ctx.props = {
          userId: session?.userId,
        };
        return ZeroMCP.serve('/mcp', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
      },
      { replaceRequest: false },
    )
    .route('/api', this.api)
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

  async fetch(request: Request): Promise<Response> {
    if (request.url.includes('/zero/durable-mailbox')) {
      const res = await routePartykitRequest(request, env as unknown as Record<string, unknown>, {
        prefix: 'zero',
      });
      if (res) return res;
    }
    return this.app.fetch(request, this.env, this.ctx);
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
                console.error(
                  `Failed to enable brain function for connection ${connectionId}:`,
                  error,
                );
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

export { DurableMailbox, ZeroAgent, ZeroMCP, MainWorkflow, ZeroWorkflow, ThreadWorkflow, ZeroDB };
