import { createHmac } from 'node:crypto';

const { KEIKI_WEBHOOK_SECRET, KEIKI_CALLBACK_URL, VITE_PUBLIC_BACKEND_URL } = process.env;
const base = KEIKI_CALLBACK_URL || VITE_PUBLIC_BACKEND_URL;
if (!base || !KEIKI_WEBHOOK_SECRET || KEIKI_WEBHOOK_SECRET.length < 32)
  throw new Error(
    'Set KEIKI_CALLBACK_URL (or VITE_PUBLIC_BACKEND_URL) and KEIKI_WEBHOOK_SECRET (at least 32 characters).',
  );
const body = JSON.stringify({ operation: 'configure_shared_assistant' });
const timestamp = Date.now();
const response = await fetch(new URL('/api/assistant/hooks/setup', base), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-keiki-timestamp': String(timestamp),
    'x-keiki-signature': `sha256=${createHmac('sha256', KEIKI_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex')}`,
  },
  body,
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok)
  throw new Error(`Assistant setup failed (${response.status}); check the backend configuration.`);
const result = (await response.json()) as { agentId: string; name: string };
console.log(
  `Configured shared agent ${result.name} (${result.agentId}). Set KEIKI_AGENT_ID to this ID in Zero. No per-user agents were created.`,
);
