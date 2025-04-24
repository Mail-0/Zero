'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function deleteUser() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) return { success: false, error: 'Session not found' };

  const token = session.session.token;
  const userId = session.user?.id;

  if (!token) return { success: false, error: 'Token not found' };
  if (!userId) return { success: false, error: 'User not found' };

  const { success, message } = await auth.api.deleteUser({
    body: {
      callbackURL: '/login',
      token,
    },
  });
  return { success, message };
}
