import { getDriverFromConnectionId, ZeroMCP } from '../services/mcp-service/mcp';
import { CallService } from '../services/call-service/call-service';
import { composeEmail } from '../trpc/routes/ai/compose';
import { env } from 'cloudflare:workers';
import { tools } from './agent/tools';
import { Tools } from '../types';
import twilio from 'twilio';
import { Hono } from 'hono';

export const aiRouter = new Hono();

aiRouter.get('/', (c) => c.text('Twilio + ElevenLabs + AI Phone System Ready'));

aiRouter.post('/do/:action', async (c) => {
  const action = c.req.param('action') as Tools;
  const body = await c.req.json();
  console.log('[DEBUG] action', action, body);
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const driver = await getDriverFromConnectionId(connectionId);
    switch (action) {
      case Tools.ListThreads:
        const threads = await Promise.all(
          (await driver.list({ folder: 'inbox', maxResults: 5 })).threads.map((thread) =>
            driver.get(thread.id).then((thread) => ({
              id: thread.latest?.id,
              subject: thread.latest?.subject,
              sender: thread.latest?.sender,
              date: thread.latest?.receivedOn,
            })),
          ),
        );
        return c.json({ success: true, result: threads });
      case Tools.ComposeEmail:
        const newBody = await composeEmail({
          prompt: body.prompt,
          emailSubject: body.emailSubject,
          username: 'Nizar Abi Zaher',
          connectionId,
        });
        return c.json({ success: true, result: newBody });
      case Tools.SendEmail:
        const result = await driver.create({
          to: body.to.map((to: any) => ({
            name: to.name ?? to.email,
            email: to.email ?? 'founders@0.email',
          })),
          subject: body.subject,
          message: body.message,
          attachments: [],
          headers: {},
        });
        return c.json({ success: true, result });
      default:
        return c.json({ success: false, error: 'Not implemented' }, 400);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

aiRouter.mount(
  '/mcp',
  async (request, env, ctx) => {
    const connectionId = request.headers.get('X-Connection-Id');
    if (!connectionId) {
      return new Response('Unauthorized', { status: 401 });
    }

    ctx.props = {
      connectionId,
    };

    return ZeroMCP.serve('/api/ai/mcp', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
  },
  { replaceRequest: false },
);

aiRouter.post('/voice', async (c) => {
  const formData = await c.req.formData();
  const callSid = formData.get('CallSid') as string;
  const from = formData.get('From') as string;

  console.log(`Incoming call from ${from} with callSid ${callSid}`);

  const hostHeader = c.req.header('host');
  console.log('[DEBUG] hostHeader', hostHeader);
  const voiceResponse = new twilio.twiml.VoiceResponse();
  voiceResponse.connect().stream({
    url: `wss://${hostHeader}/api/ai/call/${callSid}`,
  });

  c.header('Content-Type', 'application/xml');
  return c.body(voiceResponse.toString());
});

aiRouter.get('/call/:callSid', async (c) => {
  const hostname = env.VITE_PUBLIC_BACKEND_URL;

  console.log('[DEBUG] hostname', hostname, c.req.header('host'), c.req.param('callSid'));
  const callSid = c.req.param('callSid');

  console.log(`[Twilio] WebSocket connection requested`);

  // Check for WebSocket upgrade header
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  console.log(`[Twilio] WebSocket connection requested for call ${callSid}`);

  // Create WebSocket pair
  const [client, server] = Object.values(new WebSocketPair());

  // Accept the server WebSocket
  server.accept();

  const callService = new CallService(callSid);
  console.log(`[Twilio] Call service created`);

  c.executionCtx.waitUntil(callService.startCall(server, hostname));

  // Handle WebSocket events
  server.addEventListener('open', () => {
    console.log(`[Twilio] WebSocket connection opened`);
  });

  // Return response with status 101 and client WebSocket
  console.log(`[Twilio] Returning response with status 101 and client WebSocket`);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});
