import { connection } from '@zero/db/schema';
import { createDriver } from '@/lib/driver';
import { revalidatePath } from 'next/cache';
import { toByteArray } from 'base64-js';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

export const FatalErrors = ['invalid_grant'];

export const deleteActiveConnection = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.connectionId) {
    try {
      console.log('Server: Successfully deleted connection, please reload');
      await auth.api.signOut({ headers: request.headers });
      await db
        .delete(connection)
        .where(
          and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)),
        );
      return revalidatePath('/mail/inbox');
    } catch (error) {
      console.error('Server: Error deleting connection:', error);
      throw error;
    }
  } else {
    console.log('No connection ID found');
  }
};

export const getActiveDriver = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session || !session.connectionId) {
    throw new Error('Invalid session');
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection) {
    throw new Error('Invalid connection');
  }

  if (!_connection.accessToken || !_connection.refreshToken) {
    throw new Error('Invalid connection');
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      accessToken: _connection.accessToken,
      refreshToken: _connection.refreshToken,
      email: _connection.email,
    },
  });

  return driver;
};

export function fromBase64Url(str: string) {
  return str.replace(/-/g, '+').replace(/_/g, '/');
}

export function fromBinary(str: string) {
  const bytes = toByteArray(str.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(bytes);
}

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
