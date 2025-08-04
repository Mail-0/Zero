import { systemPrompt } from '../services/call-service/system-prompt';
import { openai } from '@ai-sdk/openai';
import { tools } from './agent/tools';
import { generateText } from 'ai';
import { Tools } from '../types';
import { createDb } from '../db';
import { env } from '../env';
import { Hono } from 'hono';
import { z } from 'zod';

type ToolsReturnType = Awaited<ReturnType<typeof tools>>;

export const aiRouter = new Hono();

aiRouter.get('/', (c) => c.text('Twilio + ElevenLabs + AI Phone System Ready'));

// Add CORS headers for /do/* routes
aiRouter.use('/do/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', 'Content-Type, X-Voice-Secret, X-Caller');
  c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (c.req.method === 'OPTIONS') {
    return c.text('');
  }
  return next();
});

aiRouter.post('/do/:action', async (c) => {
  //   if (env.DISABLE_CALLS) return c.json({ success: false, error: 'Not implemented' }, 400);
  if (env.VOICE_SECRET !== c.req.header('X-Voice-Secret'))
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  const caller = c.req.header('X-Caller');
  if (!caller) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  const user = await db.query.user.findFirst({
    where: (user, { eq, and }) =>
      and(eq(user.phoneNumber, caller), eq(user.phoneNumberVerified, true)),
  });
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const connection = await db.query.connection.findFirst({
    where: (connection, { eq, or }) =>
      or(eq(connection.id, user.defaultConnectionId!), eq(connection.userId, user.id)),
  });
  await conn.end();
  if (!connection) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const action = c.req.param('action') as keyof ToolsReturnType;
    const body = await c.req.json();
    console.log('[DEBUG] action', action, body);

    // Get all tools for this connection
    const toolset: ToolsReturnType = await tools(connection.id, action === Tools.InboxRag);
    const tool = toolset[action as keyof ToolsReturnType];

    if (!tool) {
      return c.json({ success: false, error: `Tool '${action}' not found` }, 404);
    }

    const result = await tool.execute?.(body || {}, {
      toolCallId: crypto.randomUUID(),
      messages: [],
    });
    return c.json({ success: true, result });
  } catch (error: any) {
    console.error(`Error executing tool '${c.req.param('action')}':`, error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

aiRouter.post('/call', async (c) => {
  console.log('[DEBUG] Received call request');

  if (env.DISABLE_CALLS) {
    console.log('[DEBUG] Calls are disabled');
    return c.json({ success: false, error: 'Not implemented' }, 400);
  }

  if (env.VOICE_SECRET !== c.req.header('X-Voice-Secret')) {
    console.log('[DEBUG] Invalid voice secret');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!c.req.header('X-Caller')) {
    console.log('[DEBUG] Missing caller header');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  console.log('[DEBUG] Parsing request body');
  const { success, data } = await z
    .object({
      query: z.string(),
    })
    .safeParseAsync(await c.req.json());

  if (!success) {
    console.log('[DEBUG] Invalid request body');
    return c.json({ success: false, error: 'Invalid request' }, 400);
  }

  console.log('[DEBUG] Connecting to database');
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

  console.log('[DEBUG] Finding user by phone number:', c.req.header('X-Caller'));
  const user = await db.query.user.findFirst({
    where: (user, { eq, and }) =>
      and(eq(user.phoneNumber, c.req.header('X-Caller')!), eq(user.phoneNumberVerified, true)),
  });

  if (!user) {
    console.log('[DEBUG] User not found or not verified');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  console.log('[DEBUG] Finding connection for user:', user.id);
  const connection = await db.query.connection.findFirst({
    where: (connection, { eq, or }) =>
      or(eq(connection.id, user.defaultConnectionId!), eq(connection.userId, user.id)),
  });

  await conn.end();

  if (!connection) {
    console.log('[DEBUG] No connection found for user');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  console.log('[DEBUG] Creating toolset for connection:', connection.id);
  const toolset = await tools(connection.id);
  const { text } = await generateText({
    model: openai(env.OPENAI_MODEL || 'gpt-4o'),
    system: systemPrompt,
    prompt: data.query,
    tools: toolset,
    maxSteps: 10,
  });

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain' },
  });
});
