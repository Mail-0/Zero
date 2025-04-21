import { checkRateLimit, getAuthenticatedUserId, getRatelimitModule } from '../../utils';
import type { Shortcut } from '@/config/shortcuts';
import { Ratelimit } from '@upstash/ratelimit';
import { userHotkeys } from '@zero/db/schema';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

export async function GET() {
  const userId = await getAuthenticatedUserId();

  const ratelimit = getRatelimitModule({
    prefix: 'ratelimit:hotkeys',
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  const result = await db.select().from(userHotkeys).where(eq(userHotkeys.userId, userId));

  return NextResponse.json(result[0]?.shortcuts || []);
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();

  const ratelimit = getRatelimitModule({
    prefix: 'ratelimit:hotkeys-post',
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }
  const shortcuts = (await request.json()) as Shortcut[];
  const now = new Date();

  await db
    .insert(userHotkeys)
    .values({
      userId: userId,
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
  const userId = await getAuthenticatedUserId();

  const ratelimit = getRatelimitModule({
    prefix: 'ratelimit:hotkeys-put',
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }
  const shortcut = (await request.json()) as Shortcut;
  const now = new Date();

  const result = await db.select().from(userHotkeys).where(eq(userHotkeys.userId, userId));

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
      userId,
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
