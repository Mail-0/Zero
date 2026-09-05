import { TRPCError } from '@trpc/server';
import type { IGetThreadResponse } from './driver/types';
import { env } from '../env';

export type ImapAccount = {
  id: string;
  email: string;
  name: string;
  preset: string;
  createdAt: string;
  saveSent: boolean;
};
export type ImapFolder = { id: string; name: string; specialUse: string | null; type: string };
export type ImapPage = {
  threads: {
    id: string;
    historyId: null;
    $raw: {
      subject: string;
      uid: number;
      folder: string;
      sender: string;
      receivedOn: string;
      unread: boolean;
      starred: boolean;
    };
  }[];
  nextPageToken: string | null;
};
export type ImapAiSettings = {
  baseUrl: string;
  model: string;
  hasKey: boolean;
  allowedOrigins: string[];
};
export type ImapSendResult = {
  id: string;
  accepted: string[];
  rejected: string[];
  sentCopySaved: boolean | null;
  replayed?: boolean;
};
export type ImapThread = IGetThreadResponse;

// The URL and service secret are administrator-owned Worker bindings, never VITE_PUBLIC_*.
export async function imapBridge<T>(ownerId: string, action: string, input: unknown = {}): Promise<T> {
  const config = env as typeof env & { IMAP_BRIDGE_URL?: string; IMAP_BRIDGE_SECRET?: string };
  if (!config.IMAP_BRIDGE_URL || !config.IMAP_BRIDGE_SECRET) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'IMAP bridge is not configured by the server administrator.' });
  }
  let url: URL;
  try {
    url = new URL(config.IMAP_BRIDGE_URL);
  } catch {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Invalid IMAP_BRIDGE_URL.' });
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The bridge requires HTTPS, except for a local development loopback address.' });
  }
  url.pathname = '/rpc';
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.IMAP_BRIDGE_SECRET}` },
      body: JSON.stringify({ ownerId, action, input }),
      signal: AbortSignal.timeout(95000),
    });
  } catch {
    throw new TRPCError({ code: 'TIMEOUT', message: action === 'mail.send'
      ? 'SMTP result is unknown. Check Sent before retrying; keep the same operation ID.'
      : 'The IMAP bridge is unreachable or timed out.' });
  }
  const body = await response.json().catch(() => null) as { result?: T; error?: { code?: string; message?: string } } | null;
  if (!response.ok || !body || !Object.hasOwn(body, 'result')) {
    const message = body?.error?.message || 'IMAP bridge request failed.';
    const code = response.status === 429 ? 'TOO_MANY_REQUESTS' : response.status === 404 ? 'NOT_FOUND'
      : response.status === 409 ? 'CONFLICT' : response.status === 413 ? 'PAYLOAD_TOO_LARGE'
        : response.status === 422 ? 'PRECONDITION_FAILED' : 'BAD_REQUEST';
    // Bridge errors are deliberately redacted. Do not attach provider exceptions or input as causes.
    throw new TRPCError({ code, message: `${body?.error?.code || 'BRIDGE_ERROR'}: ${message}` });
  }
  return body.result as T;
}
