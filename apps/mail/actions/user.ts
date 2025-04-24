'use server';

import { connection, user } from '@zero/db/schema';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

export async function deleteUser() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) return { success: false, error: 'Session not found' };

  const userId = session.user?.id;

  if (!userId) return { success: false, error: 'User not found' };

  const { success, message } = await auth.api.deleteUser({
    body: {
      callbackURL: '/login',
    },
    headers: headersList,
  });

  if (success) {
    await db.delete(connection).where(eq(connection.userId, userId));
    await db.delete(user).where(eq(user.id, userId));

    await auth.api.signOut({ headers: headersList });
  }

  return { success, message };
}
