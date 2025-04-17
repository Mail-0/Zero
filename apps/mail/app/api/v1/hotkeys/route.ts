import type { Shortcut } from '@/config/shortcuts';
import { userHotkeys } from '@zero/db/schema';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await db.select().from(userHotkeys).where(eq(userHotkeys.userId, session.user.id));

  return NextResponse.json(result[0]?.shortcuts || []);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shortcuts = (await request.json()) as Shortcut[];
  const now = new Date();

  await db
    .insert(userHotkeys)
    .values({
      userId: session.user.id,
      shortcuts,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userHotkeys.userId],
      set: {
        shortcuts,
        updatedAt: now,
      },
    });

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shortcut = (await request.json()) as Shortcut;
  const now = new Date();

  const result = await db.select().from(userHotkeys).where(eq(userHotkeys.userId, session.user.id));

  const existingShortcuts = (result[0]?.shortcuts || []) as Shortcut[];
  const updatedShortcuts = existingShortcuts.map((s: Shortcut) =>
    s.action === shortcut.action ? shortcut : s,
  );

  if (!existingShortcuts.some((s: Shortcut) => s.action === shortcut.action)) {
    updatedShortcuts.push(shortcut);
  }

  await db
    .insert(userHotkeys)
    .values({
      userId: session.user.id,
      shortcuts: updatedShortcuts,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userHotkeys.userId],
      set: {
        shortcuts: updatedShortcuts,
        updatedAt: now,
      },
    });

  return NextResponse.json({ success: true });
}
