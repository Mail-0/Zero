/**
 * IMAP/SMTP connection onboarding: discover server settings, test credentials, create or
 * reconnect a connection, and read back non-secret settings.
 */
import { cloudflareSocketFactory } from '../../lib/mail-transport/cloudflare-socket';
import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { getZeroAgent, getZeroDB } from '../../lib/server-utils';
import { CredentialCipher } from '../../lib/crypto/credentials';
import { IMAP_TOKEN_MARKER } from '../../lib/connection-status';
import { discoverMailSettings } from '../../lib/imap/discovery';
import { testImapSmtpSettings } from '../../lib/driver/imap';
import { Ratelimit } from '@upstash/ratelimit';
import { TRPCError } from '@trpc/server';
import { env } from '../../env';
import { z } from 'zod';

const serverSchema = z.object({
  host: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+$/, 'Invalid host'),
  port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .refine((port) => port !== 25, {
      message: 'Port 25 is not supported; use 465 or 587 for SMTP',
    }),
  security: z.enum(['tls', 'starttls']),
  username: z.string().min(1).max(320),
});

const settingsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(200).optional(),
  password: z.string().min(1).max(1024),
  imap: serverSchema,
  smtp: serverSchema,
  serverSavesSent: z.boolean().optional(),
});

const assertEnabled = () => {
  if (env.IMAP_ENABLED !== 'true')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'IMAP connections are not enabled' });
};

const cipher = () => {
  const instance = new CredentialCipher(env.CREDENTIALS_ENCRYPTION_KEYS);
  if (!instance.configured)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Credential encryption is not configured',
    });
  return instance;
};

const testOrThrow = async (input: z.infer<typeof settingsSchema>) => {
  const result = await testImapSmtpSettings(
    {
      imap: input.imap,
      smtp: input.smtp,
      auth: { method: 'password', password: input.password },
    },
    cloudflareSocketFactory,
  );
  if (!result.imap.ok || !result.smtp.ok) {
    const failed = !result.imap.ok ? 'IMAP' : 'SMTP';
    const detail = !result.imap.ok ? result.imap : result.smtp;
    throw new TRPCError({
      code: detail.kind === 'auth' ? 'UNAUTHORIZED' : 'BAD_REQUEST',
      message:
        detail.kind === 'auth'
          ? `${failed} login failed. Check the username and password (many providers require an app password).`
          : `${failed} connection failed: ${detail.error ?? 'unknown error'}`,
      cause: result,
    });
  }
  return result;
};

const rateLimited = (name: string, limit: number) =>
  createRateLimiterMiddleware({
    limiter: Ratelimit.slidingWindow(limit, '10m'),
    generatePrefix: ({ sessionUser }) => `ratelimit:imap-${name}-${sessionUser?.id}`,
  });

export const imapConnectionsRouter = router({
  enabled: privateProcedure.query(() => ({ enabled: env.IMAP_ENABLED === 'true' })),

  discover: privateProcedure
    .use(rateLimited('discover', 30))
    .input(z.object({ email: z.string().trim().toLowerCase().email() }))
    .query(async ({ input }) => {
      assertEnabled();
      const discovered = await discoverMailSettings(input.email);
      const localPart = input.email.split('@')[0]!;
      const username = discovered.username === 'localpart' ? localPart : input.email;
      return {
        ...discovered,
        imap: { ...discovered.imap, username },
        smtp: { ...discovered.smtp, username },
      };
    }),

  test: privateProcedure
    .use(rateLimited('test', 20))
    .input(settingsSchema)
    .mutation(async ({ input }) => {
      assertEnabled();
      const result = await testImapSmtpSettings(
        {
          imap: input.imap,
          smtp: input.smtp,
          auth: { method: 'password', password: input.password },
        },
        cloudflareSocketFactory,
      );
      return {
        imap: { ok: result.imap.ok, error: result.imap.error, kind: result.imap.kind },
        smtp: { ok: result.smtp.ok, error: result.smtp.error, kind: result.smtp.kind },
      };
    }),

  /** Creates a connection, or updates credentials/settings when the address is already connected. */
  create: privateProcedure
    .use(rateLimited('create', 10))
    .input(settingsSchema)
    .mutation(async ({ input, ctx }) => {
      assertEnabled();
      const { sessionUser } = ctx;
      const db = await getZeroDB(sessionUser.id);
      const existing = (await db.findManyConnections()).find(
        (connection) => connection.email === input.email,
      );
      if (existing && existing.providerId !== 'imap')
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This address is already connected with another provider',
        });

      if (!existing) {
        try {
          const check = await ctx.autumn.check({
            customer_id: sessionUser.id,
            feature_id: 'connections',
          });
          if (check.data && check.data.allowed === false)
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Connection limit reached' });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          // Billing unavailable: the client enforces the limit too.
        }
      }

      const capabilities = await testOrThrow(input);
      const id = existing?.id ?? crypto.randomUUID();
      const secret = await cipher().encrypt(input.password, id);
      const result = await db.upsertImapConnection({
        id,
        email: input.email,
        name: input.name || null,
        accessToken: IMAP_TOKEN_MARKER,
        settings: {
          imapHost: input.imap.host,
          imapPort: input.imap.port,
          imapSecurity: input.imap.security,
          imapUsername: input.imap.username,
          smtpHost: input.smtp.host,
          smtpPort: input.smtp.port,
          smtpSecurity: input.smtp.security,
          smtpUsername: input.smtp.username,
          authMethod: 'password',
          oauthProvider: null,
          encryptedSecret: secret.ciphertext,
          iv: secret.iv,
          keyVersion: secret.keyVersion,
          serverSavesSent: input.serverSavesSent ?? false,
          capabilities: capabilities.imap.capabilities ?? [],
        },
      });

      const user = await db.findUser();
      if (!user?.defaultConnectionId) await db.updateUser({ defaultConnectionId: result.id });

      // Start (or restart, after a reconnect) the mailbox sync.
      try {
        const agent = await getZeroAgent(result.id);
        await agent.retryMailboxSync();
      } catch (error) {
        console.warn('[imap.create] failed to start sync', { error: String(error) });
      }
      return { id: result.id, created: result.created };
    }),

  /** Non-secret settings for the edit/reconnect form. */
  settings: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getZeroDB(ctx.sessionUser.id);
      const connection = await db.findUserConnection(input.connectionId);
      if (!connection || connection.providerId !== 'imap')
        throw new TRPCError({ code: 'NOT_FOUND' });
      const settings = await db.findImapSettings(input.connectionId);
      if (!settings) throw new TRPCError({ code: 'NOT_FOUND' });
      return {
        email: connection.email,
        name: connection.name,
        authMethod: settings.authMethod,
        oauthProvider: settings.oauthProvider,
        status: settings.status,
        serverSavesSent: settings.serverSavesSent,
        imap: {
          host: settings.imapHost,
          port: settings.imapPort,
          security: settings.imapSecurity,
          username: settings.imapUsername,
        },
        smtp: {
          host: settings.smtpHost,
          port: settings.smtpPort,
          security: settings.smtpSecurity,
          username: settings.smtpUsername,
        },
      };
    }),
});
