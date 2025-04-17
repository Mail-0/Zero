'use server';

import { getAuthenticatedUserId, throwUnauthorizedGracefully } from '@/app/api/utils';
import { connection, user } from '@zero/db/schema';
import { type IConnection } from '@/types';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

export async function deleteConnection(connectionId: string) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      return throwUnauthorizedGracefully();
    }

    const userId = session?.user?.id;

    if (!userId) {
      return throwUnauthorizedGracefully();
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
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      return throwUnauthorizedGracefully();
    }

    const userId = session?.user?.id;

    if (!userId) {
      return throwUnauthorizedGracefully();
    }

    const [foundConnection] = await db
      .select()
      .from(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)))
      .limit(1);

    if (!foundConnection) {
      throw new Error('Connection not found');
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
    throw new Error('Failed to update connection');
  }
}
