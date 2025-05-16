import { getContext } from 'hono/context-storage';
import { connection } from '@zero/db/schema';
import type { HonoContext } from '../ctx';
import { createDriver } from './driver';
import { and, eq } from 'drizzle-orm';

export const getActiveConnection = async () => {
  const c = getContext<HonoContext>();
  const { session, db } = c.var;
  if (!session?.user) throw new Error('Session Not Found');
  if (!session.activeConnection?.id) {
    const activeConnection = await db.query.connection.findFirst({
      where: and(eq(connection.userId, session.user.id)),
    });
    if (!activeConnection)
      throw new Error(`Active connection not found for user ${session.user.id}`);

    return activeConnection;
  }

  const activeConnection = await db.query.connection.findFirst({
    where: and(
      eq(connection.userId, session.user.id),
      eq(connection.id, session.activeConnection.id),
    ),
  });

  if (!activeConnection) throw new Error('Active connection not found');

  return activeConnection;
};

export const connectionToDriver = (activeConnection: typeof connection.$inferSelect) => {
  if (!activeConnection.accessToken || !activeConnection.refreshToken) {
    throw new Error('Invalid connection');
  }

  return createDriver(activeConnection.providerId, {
    auth: {
      accessToken: activeConnection.accessToken,

      refreshToken: activeConnection.refreshToken,
      email: activeConnection.email,
    },
  });
};
