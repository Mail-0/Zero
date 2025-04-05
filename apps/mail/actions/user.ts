'use server';

import { createDriver } from '@/app/api/driver';
import { connection } from '@zero/db/schema';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

export const getUserContacts = async () => {
  const headersList = await headers();

  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) throw new Error('Unauthorized');

  const [_connection] = await db
    .select()
    .from(connection)
    .where(eq(connection.userId, session.user.id))
    .orderBy(connection.createdAt);

  if (!_connection?.accessToken || !_connection.refreshToken) {
    throw new Error('Unauthorized, reconnect');
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  return await driver.getUserContacts();
};
