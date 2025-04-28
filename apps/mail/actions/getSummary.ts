'use server';
import { connection, summary } from '@zero/db/schema';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';
import axios from 'axios';

export const GetSummary = async (threadId: string) => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    return null;
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection) {
    return null;
  }

  try {
    if (!process.env.BRAIN_URL || process.env.NODE_ENV !== 'production') {
      return null;
    }

    const response = await axios
      .get(process.env.BRAIN_URL + `/brain/message/thread/${threadId}`)
      .then((e) => e.data);

    return response?.content ?? null;
  } catch (error) {
    // console.error('Error getting summary:', error);
    return null;
  }
};
