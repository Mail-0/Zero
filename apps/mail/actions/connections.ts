'use server';

import { getAuthenticatedUserId } from '@/app/api/utils';
import { connection, user } from '@zero/db/schema';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

export async function deleteConnection(connectionId: string) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not found' };
    }

    await db
      .delete(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)));

    if (connectionId === session?.connectionId) {
      await db.update(user).set({
        defaultConnectionId: null,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete connection:', error);
    throw new Error('Failed to delete connection');
  }
}

export async function putConnection(connectionId: string) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { success: false, error: 'User not found' };

    const [foundConnection] = await db
      .select()
      .from(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)))
      .limit(1);

    if (!foundConnection) {
      return { success: false, error: 'Connection not found' };
    }

    await db
      .update(user)
      .set({
        defaultConnectionId: connectionId,
      })
      .where(eq(user.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to update connection:', error);
    return { success: false, error: String(error) };
  }
}
