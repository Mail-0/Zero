import { getContext } from 'hono/context-storage';
import { connection, user } from '../db/schema';
import type { HonoContext } from '../ctx';
import { env } from 'cloudflare:workers';
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

type NotificationType = 'listThreads' | 'getThread';

type ListThreadsNotification = {
  type: 'listThreads';
  payload: {};
};

type GetThreadNotification = {
  type: 'getThread';
  payload: {
    threadId: string;
  };
};

const createNotification = (
  type: NotificationType,
  payload: ListThreadsNotification['payload'] | GetThreadNotification['payload'],
) => {
  return JSON.stringify({
    type,
    payload,
  });
};

export const notifyUser = async ({
  connectionId,
  payload,
  type,
}: {
  connectionId: string;
  payload: ListThreadsNotification['payload'] | GetThreadNotification['payload'];
  type: NotificationType;
}) => {
  console.log(`[notifyUser] Starting notification for connection ${connectionId}`, {
    type,
    payload,
  });

  const durableObject = env.ZERO_AGENT.idFromName(connectionId);
  const mailbox = env.ZERO_AGENT.get(durableObject);

  try {
    console.log(`[notifyUser] Broadcasting message`, {
      connectionId,
      type,
      payload,
    });
    await mailbox.broadcast(createNotification(type, payload));
    console.log(`[notifyUser] Successfully broadcasted message`, {
      connectionId,
      type,
      payload,
    });
  } catch (error) {
    console.error(`[notifyUser] Failed to broadcast message`, {
      connectionId,
      payload,
      type,
      error,
    });
    throw error;
  }
};

export const verifyToken = async (token: string) => {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to verify token: ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  return !!data;
};
