import { createDriver } from '@/app/api/driver';
import { connection } from '@zero/db/schema';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

export const FatalErrors = ['invalid_grant'];

export const deleteActiveConnection = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session || !session.connectionId) {
    console.error('Server: Unauthorized, no valid session');
    throw new Error('Unauthorized, reconnect');
  }

  try {
    await db
      .delete(connection)
      .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));
    console.log('Server: Successfully deleted connection, please reload');
    return revalidatePath('/mail');
  } catch (error) {
    console.error('Server: Error deleting connection:', error);
    throw error;
  }
};

export const getActiveDriver = async (connectionId?: string) => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) {
    console.error('Server: Unauthorized, no valid session');
    throw new Error('Unauthorized, reconnect');
  }

  // If specific connectionId is provided, use it instead of session.connectionId
  const targetConnectionId = connectionId || session.connectionId;

  if (!targetConnectionId) {
    console.error('Server: No connection ID provided');
    throw new Error('Unauthorized, reconnect');
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, targetConnectionId)));

  if (!_connection) {
    throw new Error('Unauthorized, reconnect');
  }

  if (!_connection.accessToken || !_connection.refreshToken) {
    throw new Error('Unauthorized, reconnect');
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  return driver;
};
