import { connection } from '@zero/db/schema';
import { createDriver } from '@/lib/driver';
import { toByteArray } from 'base64-js';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

export const FatalErrors = ['invalid_grant'];

export const deleteActiveConnection = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.connectionId) return console.log('No connection ID found');
  try {
    await auth.api.signOut({ headers: request.headers });
    await db
      .delete(connection)
      .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));
  } catch (error) {
    console.error('Server: Error deleting connection:', error);
    throw error;
  }
};

export const getActiveDriver = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.connectionId) throw new Error('Invalid session');

  const activeConnection = await db.query.connection.findFirst({
    where: and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)),
  });

  if (!activeConnection || !activeConnection.accessToken || !activeConnection.refreshToken)
    throw new Error('Invalid connection');

  return createDriver(activeConnection.providerId, {
    auth: {
      accessToken: activeConnection.accessToken,
      refreshToken: activeConnection.refreshToken,
      email: activeConnection.email,
    },
  });
};

export const fromBase64Url = (str: string) => str.replace(/-/g, '+').replace(/_/g, '/');

export const fromBinary = (str: string) =>
  new TextDecoder().decode(toByteArray(str.replace(/-/g, '+').replace(/_/g, '/')));

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
  context?: Record<string, any>;
  originalError: unknown;
  constructor(error: Error & { code: string }, operation: string, context?: Record<string, any>) {
    super(error?.message || 'An unknown error occurred');
    this.name = 'StandardizedError';
    this.code = error?.code || 'UNKNOWN_ERROR';
    this.operation = operation;
    this.context = context;
    this.originalError = error;
  }
}

export function sanitizeContext(context?: Record<string, any>) {
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
