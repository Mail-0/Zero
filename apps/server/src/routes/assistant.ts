import {
  assistantAgentId,
  AssistantToolError,
  assistantUserForContext,
  configureAssistant,
  signAssistantToken,
  authorizedAssistantContext,
  digest,
  executeMailTool,
  ownedMailbox,
  ownedDraftSource,
  resolveMailTool,
  withAssistantDb,
  writeTools,
} from '../lib/assistant';
import {
  draftActionPreview,
  draftWriteTools,
  sourceDraftTools,
  prepareDraftAction,
  readAssistantDraft,
} from '../lib/assistant-drafts';
import { assistantAction, assistantIdentity, assistantLink, connection } from '../db/schema';
import { verifyWebhook, type IdentityWebhookAnswer } from '@onkeiki/agents/cloud';
import { assistantAppPresentation } from '../lib/assistant-approval';
import { and, eq, gt, isNull, sql, count } from 'drizzle-orm';
import { isAiEnabledForUser } from '../lib/ai-access';
import type { HonoContext } from '../ctx';
import type { ErrorHandler } from 'hono';
import { env } from '../env';
import { Hono } from 'hono';
import { z } from 'zod';

const senderSchema = z.object({
  channel: z.literal('photon'),
  gateway: z.string().min(1),
  sender: z.string().min(1).max(320),
  conversation: z.string(),
  messageId: z.string(),
  text: z.string().max(32_000),
  isDirect: z.boolean(),
});
const linkUrl = (token: string) =>
  `${env.VITE_PUBLIC_APP_URL}/assistant/connect?token=${encodeURIComponent(token)}`;
const actionUrl = (id: string) =>
  `${env.VITE_PUBLIC_APP_URL}/assistant/action/${encodeURIComponent(id)}`;

const handleAssistantError: ErrorHandler<HonoContext> = (error, c) => {
  if (error instanceof AssistantToolError)
    return c.json({ error: error.message, code: error.code }, error.status);
  if (error instanceof z.ZodError)
    return c.json(
      {
        error: 'Invalid tool input. Correct the listed fields and retry using the tool schema.',
        code: 'invalid_tool_input',
        issues: error.issues.map(({ path, message }) => ({ path, message })),
      },
      400,
    );
  console.error('[assistant request]', error);
  return c.json({ error: 'Assistant request failed' }, 500);
};

const identityReply = (reply: string): IdentityWebhookAnswer => ({
  userId: null,
  scopes: [],
  ttlSeconds: 0,
  reply,
});
const accountPrincipal = (userId: string): IdentityWebhookAnswer => ({
  userId,
  role: 'owner',
  scopes: ['mail:read', 'mail:request_action'],
  ttlSeconds: 0,
});
async function identifyPhotonSender(
  sender: z.infer<typeof senderSchema>,
): Promise<IdentityWebhookAnswer> {
  if (!sender.isDirect || sender.channel !== 'photon' || sender.gateway !== env.KEIKI_PHOTON_LINE)
    return identityReply('Use a private iMessage conversation to connect your account.');
  const confirmation = sender.text
    .trim()
    .match(/^connect\s+([a-f0-9]{12})$/i)?.[1]
    ?.toLowerCase();
  if (confirmation) {
    const linked = await withAssistantDb((db) =>
      db.transaction(async (tx) => {
        const [link] = await tx
          .select()
          .from(assistantLink)
          .where(
            and(
              eq(assistantLink.channel, sender.channel),
              eq(assistantLink.gateway, sender.gateway),
              eq(assistantLink.sender, sender.sender),
              eq(assistantLink.challenge, confirmation),
              gt(assistantLink.expiresAt, new Date()),
            ),
          )
          .for('update');
        if (!link?.userId) return false;
        const [existing] = await tx
          .select()
          .from(assistantIdentity)
          .where(
            and(
              eq(assistantIdentity.channel, sender.channel),
              eq(assistantIdentity.gateway, sender.gateway),
              eq(assistantIdentity.sender, sender.sender),
            ),
          )
          .for('update');
        if (existing && existing.userId !== link.userId) return false;
        // A delivery retry may arrive after the success reply failed. It may
        // acknowledge an active binding, but never reactivate a revoked one.
        if (link.consumedAt) return !!existing?.active;
        if (existing)
          await tx
            .update(assistantIdentity)
            .set({ active: true })
            .where(eq(assistantIdentity.id, existing.id));
        else
          await tx
            .insert(assistantIdentity)
            .values({
              id: crypto.randomUUID(),
              channel: sender.channel,
              gateway: sender.gateway,
              sender: sender.sender,
              userId: link.userId,
            })
            .onConflictDoNothing();
        const [binding] = await tx
          .select()
          .from(assistantIdentity)
          .where(
            and(
              eq(assistantIdentity.channel, sender.channel),
              eq(assistantIdentity.gateway, sender.gateway),
              eq(assistantIdentity.sender, sender.sender),
            ),
          );
        if (binding?.userId !== link.userId) return false;
        await tx
          .update(assistantLink)
          .set({ consumedAt: new Date() })
          .where(eq(assistantLink.tokenHash, link.tokenHash));
        return true;
      }),
    );
    return identityReply(
      linked
        ? 'Your Zero assistant is connected. Send a new message to get started.'
        : 'That connection code is invalid or expired. Open a new connection link and try again.',
    );
  }
  const identity = await withAssistantDb(
    async (db) =>
      (
        await db
          .select()
          .from(assistantIdentity)
          .where(
            and(
              eq(assistantIdentity.channel, sender.channel),
              eq(assistantIdentity.gateway, sender.gateway),
              eq(assistantIdentity.sender, sender.sender),
            ),
          )
      )[0],
  );
  if (identity?.active && identity.userId) {
    if (!(await isAiEnabledForUser(identity.userId)))
      return identityReply('AI is disabled in your Zero settings.');
    return accountPrincipal(identity.userId);
  }
  if (identity && !identity.userId)
    return identityReply('This messaging identity is no longer connected to a Zero account.');
  if (!sender.messageId)
    return identityReply('Send a new private iMessage to connect your Zero account.');
  // Stable across delivery retries, but a new message can obtain a fresh link
  // immediately after a consumed link or a disconnect.
  const token = await signAssistantToken(
    JSON.stringify(['link', sender.channel, sender.gateway, sender.sender, sender.messageId]),
  );
  const tokenHash = await digest(token);
  const allowed = await withAssistantDb((db) =>
    db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${JSON.stringify([sender.channel, sender.gateway, sender.sender])}))`,
      );
      const [existing] = await tx
        .select({ hash: assistantLink.tokenHash })
        .from(assistantLink)
        .where(eq(assistantLink.tokenHash, tokenHash));
      if (existing) return true;
      const [recent] = await tx
        .select({ count: count() })
        .from(assistantLink)
        .where(
          and(
            eq(assistantLink.channel, sender.channel),
            eq(assistantLink.gateway, sender.gateway),
            eq(assistantLink.sender, sender.sender),
            gt(assistantLink.createdAt, new Date(Date.now() - 60_000)),
          ),
        );
      if (recent && recent.count >= 5) return false;
      await tx
        .insert(assistantLink)
        .values({
          tokenHash,
          channel: sender.channel,
          gateway: sender.gateway,
          sender: sender.sender,
          expiresAt: new Date(Date.now() + 10 * 60_000),
        })
        .onConflictDoNothing();
      return true;
    }),
  );
  if (!allowed) return identityReply('Too many connection attempts. Try again in a minute.');
  return identityReply(`Connect your Zero account to use your assistant: ${linkUrl(token)}`);
}

/** Signed callbacks are mounted outside the session/JWT middleware. */
export const assistantHooks = new Hono<HonoContext>()
  .use('*', async (c, next) => {
    const body = await c.req.text();
    if (
      !env.KEIKI_WEBHOOK_SECRET ||
      !(await verifyWebhook(c.req.raw, body, env.KEIKI_WEBHOOK_SECRET))
    )
      return c.json({ error: 'Invalid signature' }, 401);
    await next();
  })
  .post('/setup', async (c) => {
    const parsed = z
      .object({ operation: z.literal('configure_shared_assistant') })
      .strict()
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Invalid setup request' }, 400);
    const deployment = await configureAssistant();
    return c.json({ agentId: deployment.agent.id, name: deployment.agent.name });
  })
  .post('/identity', async (c) => {
    const parsed = z
      .object({
        agent: z.object({ id: z.string() }),
        sender: z.object({
          channel: z.string(),
          teamId: z.string().optional(),
          userId: z.string().optional(),
          conversationId: z.string().optional(),
          addressing: z.object({ isDm: z.boolean() }).optional(),
        }),
        conversation: z.object({ id: z.string() }),
        messages: z
          .array(z.object({ id: z.string().optional(), text: z.string().max(32_000) }))
          .max(40)
          .optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Invalid identity request' }, 400);
    const { agent, sender, conversation, messages } = parsed.data;
    if (agent.id !== assistantAgentId())
      return c.json(identityReply('Not authorized for this assistant.'));
    if (sender.channel === 'api') {
      const userId = await assistantUserForContext({
        agentId: agent.id,
        phone: conversation.id,
        channel: { channel: 'api', conversationId: sender.conversationId },
      });
      if (!userId || !(await isAiEnabledForUser(userId)))
        return c.json(identityReply('Sign in to Zero with AI enabled to use this conversation.'));
      return c.json(accountPrincipal(userId));
    }
    if (sender.channel !== 'photon' || sender.userId !== conversation.id)
      return c.json(identityReply('Messaging identity is not supported.'));
    const message = messages?.at(-1);
    const photon = senderSchema.safeParse({
      channel: 'photon',
      gateway: sender.teamId,
      sender: sender.userId,
      conversation: conversation.id,
      isDirect: sender.addressing?.isDm === true,
      messageId: message?.id || '',
      text: message?.text || '',
    });
    return c.json(
      photon.success
        ? await identifyPhotonSender(photon.data)
        : identityReply('Use a private iMessage conversation to connect your account.'),
    );
  })
  .post('/tools/:tool', async (c) => {
    const parsed = z
      .object({
        input: z.unknown(),
        context: z.object({
          agentId: z.string(),
          phone: z.string(),
          traceId: z.string().optional(),
          channel: z.object({
            channel: z.string(),
            provider: z.string().optional(),
            gateway: z.string().optional(),
            userId: z.string().optional(),
            isDirect: z.boolean().optional(),
            conversationId: z.string().optional(),
          }),
          principal: z
            .object({ userId: z.string().nullable(), scopes: z.array(z.string()) })
            .optional(),
        }),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Invalid tool request' }, 400);
    const userId = await authorizedAssistantContext(parsed.data.context);
    if (!userId || !(await isAiEnabledForUser(userId)))
      return c.json({ error: 'Not authorized' }, 403);
    const name = c.req.param('tool');
    if (name === 'get_action_status') {
      const { id } = z.object({ id: z.string() }).parse(parsed.data.input);
      const action = await withAssistantDb(
        async (db) =>
          (
            await db
              .select({
                connectionId: assistantAction.connectionId,
                input: assistantAction.input,
                status: assistantAction.status,
                result: assistantAction.result,
                expiresAt: assistantAction.expiresAt,
              })
              .from(assistantAction)
              .where(and(eq(assistantAction.id, id), eq(assistantAction.userId, userId)))
          )[0],
      );
      if (!action) return c.json({ error: 'Action not found' }, 404);
      await ownedMailbox(userId, action.connectionId);
      await ownedDraftSource(userId, action.input);
      return c.json({
        id,
        connectionId: action.connectionId,
        status: action.status,
        result: action.result,
        expiresAt: action.expiresAt,
        expired: action.expiresAt < new Date(),
      });
    }
    if (name === 'list_mailboxes') {
      const mailboxes = await withAssistantDb((db) =>
        db
          .select({ connectionId: connection.id, email: connection.email })
          .from(connection)
          .where(eq(connection.userId, userId)),
      );
      return c.json({ mailboxes });
    }
    const input = z
      .object({ connectionId: z.string().min(1).optional(), input: z.unknown() })
      .parse(parsed.data.input);
    let mailbox = await ownedMailbox(userId, input.connectionId);
    const sourceMailbox = mailbox;
    const resolved = await resolveMailTool(name, mailbox.id);
    const args = (resolved.tool.parameters as z.ZodTypeAny).parse(input.input) as Record<
      string,
      unknown
    >;
    if (writeTools.has(resolved.name)) {
      if (!parsed.data.context.principal?.scopes.includes('mail:request_action'))
        return c.json({ error: 'Not authorized' }, 403);
      if (!parsed.data.context.traceId?.trim())
        return c.json(
          {
            error: 'A stable Keiki traceId is required to request a mutation safely.',
            code: 'mutation_trace_required',
          },
          400,
        );
      if (sourceDraftTools.has(resolved.name)) {
        const senderConnectionId = (args.overrides as { senderConnectionId?: string } | undefined)
          ?.senderConnectionId;
        if (senderConnectionId) mailbox = await ownedMailbox(userId, senderConnectionId);
      }
      const id = await digest(
        JSON.stringify([
          userId,
          mailbox.id,
          name,
          args,
          parsed.data.context.traceId,
          ...(sourceMailbox.id !== mailbox.id ? [sourceMailbox.id] : []),
        ]),
      );
      const [existing] = await withAssistantDb((db) =>
        db
          .select({ id: assistantAction.id })
          .from(assistantAction)
          .where(and(eq(assistantAction.id, id), eq(assistantAction.userId, userId))),
      );
      if (!existing) {
        const selfEmails =
          resolved.name === 'createReplyDraft'
            ? await withAssistantDb((db) =>
                db
                  .select({ email: connection.email })
                  .from(connection)
                  .where(eq(connection.userId, userId)),
              )
            : [];
        const actionInput = draftWriteTools.has(resolved.name)
          ? await prepareDraftAction(mailbox, resolved.name, args, {
              sourceMailbox,
              selfEmails: selfEmails.map((row) => row.email),
            })
          : args;
        await withAssistantDb((db) =>
          db
            .insert(assistantAction)
            .values({
              id,
              userId,
              connectionId: mailbox.id,
              tool: name,
              input: actionInput,
              expiresAt: new Date(Date.now() + 15 * 60_000),
            })
            .onConflictDoNothing(),
        );
      }
      const [action] = await withAssistantDb((db) =>
        db
          .select({ status: assistantAction.status, expiresAt: assistantAction.expiresAt })
          .from(assistantAction)
          .where(and(eq(assistantAction.id, id), eq(assistantAction.userId, userId))),
      );
      if (!action) throw new Error('Pending action could not be loaded');
      const awaitingApproval = action.status === 'pending' && action.expiresAt > new Date();
      const url = actionUrl(id);
      const presentation = awaitingApproval
        ? assistantAppPresentation(parsed.data.context, id, url)
        : undefined;
      return c.json({
        id,
        status: awaitingApproval ? 'confirmation_required' : action.status,
        expired: action.expiresAt <= new Date(),
        ...(awaitingApproval && draftWriteTools.has(resolved.name)
          ? { saved: false, sent: false }
          : {}),
        url,
        ...(presentation ? { presentation } : {}),
        instructions: awaitingApproval
          ? 'The action has NOT executed. Only the authenticated account owner can review and approve it in Zero. If Keiki adds presentationDelivery.state = accepted, direct the user to the review card in Messages and include this exact URL as browser fallback. Otherwise show this exact URL as the approval step. A presentation request alone is not delivery. Do not send another card manually or retry the mutation to recover delivery.'
          : 'This action was already requested. Do not claim it is awaiting approval or request it again. Use get_action_status to check its current status.',
      });
    }
    return c.json(await executeMailTool(userId, mailbox.id, name, args));
  })
  .onError(handleAssistantError);

export const assistantApi = new Hono<HonoContext>()
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    if (!c.var.sessionUser) return c.json({ error: 'Sign in to Zero' }, 401);
    if (c.req.method !== 'GET') {
      const origin = c.req.header('Origin');
      if (origin !== new URL(env.VITE_PUBLIC_APP_URL).origin)
        return c.json({ error: 'Invalid origin' }, 403);
    }
    await next();
  })
  .get('/drafts/:connectionId/:draftId', async (c) => {
    const userId = c.var.sessionUser!.id;
    if (!(await isAiEnabledForUser(userId))) return c.json({ error: 'AI is disabled' }, 403);
    const mailbox = await ownedMailbox(userId, c.req.param('connectionId'));
    return c.json({
      ...(await readAssistantDraft(mailbox.id, c.req.param('draftId'))),
      mailboxEmail: mailbox.email,
    });
  })
  .get('/status', async (c) => {
    const identities = await withAssistantDb((db) =>
      db
        .select({
          id: assistantIdentity.id,
          channel: assistantIdentity.channel,
          sender: assistantIdentity.sender,
          active: assistantIdentity.active,
        })
        .from(assistantIdentity)
        .where(eq(assistantIdentity.userId, c.var.sessionUser!.id)),
    );
    return c.json({ line: env.KEIKI_PHOTON_LINE, identities });
  })
  .delete('/identities/:id', async (c) => {
    await withAssistantDb((db) =>
      db.transaction(async (tx) => {
        const [identity] = await tx
          .update(assistantIdentity)
          .set({ active: false })
          .where(
            and(
              eq(assistantIdentity.id, c.req.param('id')),
              eq(assistantIdentity.userId, c.var.sessionUser!.id),
            ),
          )
          .returning();
        if (identity)
          await tx
            .update(assistantLink)
            .set({ consumedAt: new Date() })
            .where(
              and(
                eq(assistantLink.channel, identity.channel),
                eq(assistantLink.gateway, identity.gateway),
                eq(assistantLink.sender, identity.sender),
                isNull(assistantLink.consumedAt),
              ),
            );
      }),
    );
    return c.json({ ok: true });
  })
  .get('/links/:token', async (c) => {
    const tokenHash = await digest(c.req.param('token'));
    const link = await withAssistantDb(
      async (db) =>
        (
          await db
            .select()
            .from(assistantLink)
            .where(
              and(
                eq(assistantLink.tokenHash, tokenHash),
                gt(assistantLink.expiresAt, new Date()),
                isNull(assistantLink.consumedAt),
              ),
            )
        )[0],
    );
    if (!link || (link.userId && link.userId !== c.var.sessionUser!.id))
      return c.json({ error: 'Connection link expired or unavailable' }, 404);
    return c.json({
      channel: link.channel,
      sender: link.sender,
      account: c.var.sessionUser!.email,
    });
  })
  .post('/links/:token', async (c) => {
    const userId = c.var.sessionUser!.id;
    if (!(await isAiEnabledForUser(userId))) return c.json({ error: 'AI is disabled' }, 403);
    const tokenHash = await digest(c.req.param('token'));
    const challenge = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const link = await withAssistantDb(
      async (db) =>
        (
          await db
            .update(assistantLink)
            .set({ userId, challenge })
            .where(
              and(
                eq(assistantLink.tokenHash, tokenHash),
                gt(assistantLink.expiresAt, new Date()),
                isNull(assistantLink.consumedAt),
                sql`(${assistantLink.userId} is null or ${assistantLink.userId} = ${userId})`,
              ),
            )
            .returning()
        )[0],
    );
    if (!link) return c.json({ error: 'Connection link expired or unavailable' }, 404);
    return c.json({ command: `CONNECT ${challenge}`, line: env.KEIKI_PHOTON_LINE });
  })
  .get('/actions/:id', async (c) => {
    const action = await withAssistantDb(
      async (db) =>
        (
          await db
            .select()
            .from(assistantAction)
            .where(
              and(
                eq(assistantAction.id, c.req.param('id')),
                eq(assistantAction.userId, c.var.sessionUser!.id),
              ),
            )
        )[0],
    );
    if (!action) return c.json({ error: 'Action not found' }, 404);
    const mailbox = await ownedMailbox(c.var.sessionUser!.id, action.connectionId);
    await ownedDraftSource(c.var.sessionUser!.id, action.input);
    return c.json({
      ...action,
      preview: draftWriteTools.has(
        action.tool.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      )
        ? draftActionPreview(action.input)
        : undefined,
      mailboxEmail: mailbox.email,
      expired: action.expiresAt < new Date(),
    });
  })
  .post('/actions/:id', async (c) => {
    const userId = c.var.sessionUser!.id;
    if (!(await isAiEnabledForUser(userId))) return c.json({ error: 'AI is disabled' }, 403);
    const { approve } = z.object({ approve: z.boolean() }).parse(await c.req.json());
    // Atomically claim once. A timeout after sending remains indeterminate and
    // is never retried automatically: duplicate mail is worse than an error.
    const action = await withAssistantDb(
      async (db) =>
        (
          await db
            .update(assistantAction)
            .set({ status: approve ? 'running' : 'declined' })
            .where(
              and(
                eq(assistantAction.id, c.req.param('id')),
                eq(assistantAction.userId, userId),
                eq(assistantAction.status, 'pending'),
                gt(assistantAction.expiresAt, new Date()),
              ),
            )
            .returning()
        )[0],
    );
    if (!action) return c.json({ error: 'Action expired or already handled' }, 409);
    if (!approve) return c.json({ status: 'declined' });
    try {
      const result = await executeMailTool(userId, action.connectionId, action.tool, action.input);
      await withAssistantDb((db) =>
        db
          .update(assistantAction)
          .set({ status: 'completed', result })
          .where(and(eq(assistantAction.id, action.id), eq(assistantAction.userId, userId))),
      );
      return c.json({ status: 'completed', result });
    } catch (error) {
      await withAssistantDb((db) =>
        db
          .update(assistantAction)
          .set({ status: 'failed' })
          .where(and(eq(assistantAction.id, action.id), eq(assistantAction.userId, userId))),
      );
      if (error instanceof AssistantToolError)
        return c.json({ error: error.message, code: error.code }, error.status);
      console.error('[assistant action]', error);
      return c.json({ error: 'Action failed. Check your mailbox before trying again.' }, 500);
    }
  })
  .onError(handleAssistantError);
