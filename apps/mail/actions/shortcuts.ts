'use server';

import { Shortcut } from '@/config/shortcuts';
import { userHotkeys } from '@zero/db/schema';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

export async function updateShortcuts(shortcuts: Shortcut[]): Promise<void> {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    if (!session?.user?.id) throw new Error('Unauthorized');

    await db
      .insert(userHotkeys)
      .values({
        userId: session.user.id,
        shortcuts,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userHotkeys.userId,
        set: {
          shortcuts,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Error updating shortcuts in DB:', error);
    throw error;
  }
}
