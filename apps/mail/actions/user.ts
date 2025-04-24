'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function deleteUser() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) return { success: false, error: 'Session not found' };

  const userId = session.user?.id;

  if (!userId) return { success: false, error: 'User not found' };

  const { success, message } = await auth.api.deleteUser({
    body: {
      callbackURL: '/',
    },
    headers: headersList,
  });

  return { success, message };
}
