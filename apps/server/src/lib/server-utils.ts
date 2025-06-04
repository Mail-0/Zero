import { getContext } from 'hono/context-storage';
import { connection, user } from '../db/schema';
import type { HonoContext } from '../ctx';
import { createDriver } from './driver';
import { and, eq } from 'drizzle-orm';

export const getActiveConnection = async () => {
  const c = getContext<HonoContext>();
  const { sessionUser, db } = c.var;
  if (!sessionUser) throw new Error('Session Not Found');

  const userData = await db.query.user.findFirst({
    where: eq(user.id, sessionUser.id),
  });

  if (userData?.defaultConnectionId) {
    const activeConnection = await db.query.connection.findFirst({
      where: and(
        eq(connection.userId, sessionUser.id),
        eq(connection.id, userData.defaultConnectionId),
      ),
    });
    if (activeConnection) return activeConnection;
  }

  const firstConnection = await db.query.connection.findFirst({
    where: and(eq(connection.userId, sessionUser.id)),
  });
  if (!firstConnection) {
    console.error(`No connections found for user ${sessionUser.id}`);
    throw new Error('No connections found for user');
  }

  return firstConnection;
};

export const connectionToDriver = (activeConnection: typeof connection.$inferSelect) => {
  if (!activeConnection.accessToken || !activeConnection.refreshToken) {
    throw new Error('Invalid connection');
  }

  return createDriver(activeConnection.providerId, {
    auth: {
      userId: activeConnection.userId,
      accessToken: activeConnection.accessToken,
      refreshToken: activeConnection.refreshToken,
      email: activeConnection.email,
    },
  });
};
