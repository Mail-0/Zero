import type { Context } from 'hono';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import type { HonoContext, HonoVariables } from '../../ctx';
import { serializedFileSchema } from '../../lib/schemas';
import { imapBridge, type ImapAccount, type ImapAiSettings, type ImapFolder,
  type ImapPage, type ImapThread, type ImapSendResult } from '../../lib/imap-bridge';

// Deliberately do not use the upstream payload-logging middleware: inputs contain secrets and mail.
// The context and transformer match the parent router. Identity comes only from server authentication.
const t = initTRPC.context<{ c: Context<HonoContext> } & HonoVariables>().create({ transformer: superjson });
const owned = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessionUser) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in to Zero first.' });
  return next({ ctx: { ...ctx, sessionUser: ctx.sessionUser } });
});
const accountId = z.string().uuid();
const messageId = z.string().min(1).max(4096);
const recipient = z.object({ email: z.string().email().max(320), name: z.string().max(256).optional() });

export const imapRouter = t.router({
  accounts: owned.query(({ ctx }) => imapBridge<ImapAccount[]>(ctx.sessionUser.id, 'accounts.list')),
  addAccount: owned.input(z.object({
    preset: z.enum(['qq', '163', '126', 'icloud', 'custom']),
    email: z.string().email().max(320), name: z.string().max(128).default(''),
    password: z.string().min(1).max(2048), username: z.string().max(320).optional(),
    smtpUsername: z.string().max(320).optional(), smtpPassword: z.string().max(2048).optional(),
    imapHost: z.string().max(253).optional(), smtpHost: z.string().max(253).optional(),
    imapPort: z.literal(993).optional(), smtpPort: z.union([z.literal(465), z.literal(587)]).optional(),
    saveSent: z.boolean().default(false),
  }).strict()).mutation(({ ctx, input }) => imapBridge<ImapAccount>(ctx.sessionUser.id, 'accounts.add', input)),
  removeAccount: owned.input(z.object({ accountId }).strict())
    .mutation(({ ctx, input }) => imapBridge<{ success: boolean }>(ctx.sessionUser.id, 'accounts.remove', input)),
  folders: owned.input(z.object({ accountId }).strict())
    .query(({ ctx, input }) => imapBridge<ImapFolder[]>(ctx.sessionUser.id, 'mail.folders', input)),
  list: owned.input(z.object({ accountId, folder: z.string().max(1024).default('inbox'),
    query: z.string().max(512).default(''), pageToken: messageId.optional(),
    maxResults: z.number().int().min(1).max(50).default(30),
    labelIds: z.array(z.enum(['UNREAD', 'STARRED'])).max(2).default([]),
  }).strict()).query(({ ctx, input }) => imapBridge<ImapPage>(ctx.sessionUser.id, 'mail.list', input)),
  get: owned.input(z.object({ accountId, id: messageId }).strict())
    .query(({ ctx, input }) => imapBridge<ImapThread>(ctx.sessionUser.id, 'mail.get', input)),
  raw: owned.input(z.object({ accountId, id: messageId }).strict())
    .query(({ ctx, input }) => imapBridge<string>(ctx.sessionUser.id, 'mail.raw', input)),
  modify: owned.input(z.object({ accountId, ids: z.array(messageId).min(1).max(100),
    addLabels: z.array(z.enum(['UNREAD', 'STARRED', 'INBOX', 'TRASH', 'SPAM', 'ARCHIVE'])).max(6).default([]),
    removeLabels: z.array(z.enum(['UNREAD', 'STARRED', 'INBOX', 'TRASH', 'SPAM', 'ARCHIVE'])).max(6).default([]),
  }).strict()).mutation(({ ctx, input }) => imapBridge<{ success: boolean }>(ctx.sessionUser.id, 'mail.modify', input)),
  move: owned.input(z.object({ accountId, id: messageId, destination: z.string().min(1).max(1024) }).strict())
    .mutation(({ ctx, input }) => imapBridge<{ success: boolean }>(ctx.sessionUser.id, 'mail.move', input)),
  send: owned.input(z.object({ accountId, operationId: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
    to: z.array(recipient).max(100), cc: z.array(recipient).max(100).optional(),
    bcc: z.array(recipient).max(100).optional(), subject: z.string().max(998), message: z.string().max(1024 * 1024),
    attachments: z.array(serializedFileSchema).max(20).default([]),
    headers: z.record(z.string().max(2048)).default({}),
  }).strict()).mutation(({ ctx, input }) => imapBridge<ImapSendResult>(ctx.sessionUser.id, 'mail.send', input)),
  aiSettings: owned.query(({ ctx }) => imapBridge<ImapAiSettings>(ctx.sessionUser.id, 'ai.settings')),
  configureAi: owned.input(z.object({ baseUrl: z.string().url().max(1024),
    model: z.string().min(1).max(256), apiKey: z.string().max(4096).optional(),
  }).strict()).mutation(({ ctx, input }) => imapBridge<{ success: boolean }>(ctx.sessionUser.id, 'ai.configure', input)),
  removeAi: owned.mutation(({ ctx }) => imapBridge<{ success: boolean }>(ctx.sessionUser.id, 'ai.remove')),
  generate: owned.input(z.object({ accountId: accountId.optional(), id: messageId.optional(),
    task: z.enum(['summarize', 'reply', 'translate', 'compose']), instructions: z.string().max(8000).default(''),
    consent: z.literal(true),
  }).strict()).mutation(({ ctx, input }) => imapBridge<{ text: string; model: string }>(ctx.sessionUser.id, 'ai.generate', input)),
});
