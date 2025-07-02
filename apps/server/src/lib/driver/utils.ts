import { getActiveConnection, getZeroDB } from '../server-utils';
import { getContext } from 'hono/context-storage';
import type { gmail_v1 } from '@googleapis/gmail';
import type { HonoContext } from '../../ctx';
import { env } from 'cloudflare:workers';
import { createDriver } from '../driver';
import { toByteArray } from 'base64-js';
export const FatalErrors = ['invalid_grant'];

export const deleteActiveConnection = async () => {
  const c = getContext<HonoContext>();
  const activeConnection = await getActiveConnection();
  if (!activeConnection) return console.log('No connection ID found');
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return console.log('No session found');
  try {
    await c.var.auth.api.signOut({ headers: c.req.raw.headers });
    const db = getZeroDB(session.user.id);
    await db.deleteActiveConnection(activeConnection.id);
  } catch (error) {
    console.error('Server: Error deleting connection:', error);
    throw error;
  }
};

export const fromBase64Url = (str: string) => str.replace(/-/g, '+').replace(/_/g, '/');

export const fromBinary = (str: string) =>
  new TextDecoder().decode(toByteArray(str.replace(/-/g, '+').replace(/_/g, '/')));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const findHtmlBody = (parts: any[]): string => {
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return part.body.data;
    }
    if (part.parts) {
      const found = findHtmlBody(part.parts);
      if (found) return found;
    }
  }
  console.log('⚠️ Driver: No HTML content found in message parts');
  return '';
};

export class StandardizedError extends Error {
  code: string;
  operation: string;
  context?: Record<string, unknown>;
  originalError: unknown;
  constructor(
    error: Error & { code: string },
    operation: string,
    context?: Record<string, unknown>,
  ) {
    super(error?.message || 'An unknown error occurred');
    this.name = 'StandardizedError';
    this.code = error?.code || 'UNKNOWN_ERROR';
    this.operation = operation;
    this.context = context;
    this.originalError = error;
  }
}

export function sanitizeContext(context?: Record<string, unknown>) {
  if (!context) return undefined;
  const sanitized = { ...context };
  const sensitive = ['tokens', 'refresh_token', 'code', 'message', 'raw', 'data'];
  for (const key of sensitive) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Retrieves the original sender address for a forwarded email from SimpleLogin
 * from the headers of a Gmail email. Header: `X-SimpleLogin-Original-From`
 */
export function getSimpleLoginSender(payload: gmail_v1.Schema$Message['payload']) {
  return payload?.headers?.find((h) => h.name === 'X-SimpleLogin-Original-From')?.value || null;
}
