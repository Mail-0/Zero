import { isAiEnabled, resolveAiSettings } from './ai-settings';
import type { AiSettings } from './schemas';
import { getZeroDB } from './server-utils';
import { connection } from '../db/schema';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { env } from '../env';

/**
 * Server-side lookups for the per-user AI settings, used to enforce the
 * "disable AI" switch on every AI entry point (tRPC, chat agent, MCP, voice,
 * background workflows).
 */

export const AI_DISABLED_MESSAGE = 'AI features are turned off in your settings.';

/** A user's AI settings, with defaults applied. */
export async function getUserAiSettings(userId: string): Promise<AiSettings> {
  const stored = await (await getZeroDB(userId)).findUserSettings();
  return resolveAiSettings(stored?.settings);
}

/** The connection's owner and their AI settings, or undefined if the connection is gone. */
export async function getConnectionAiSettings(
  connectionId: string,
): Promise<{ userId: string; settings: AiSettings } | undefined> {
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  let userId: string | undefined;
  try {
    const [row] = await db
      .select({ userId: connection.userId })
      .from(connection)
      .where(eq(connection.id, connectionId));
    userId = row?.userId;
  } finally {
    await conn.end().catch(() => {});
  }
  if (!userId) return undefined;
  return { userId, settings: await getUserAiSettings(userId) };
}

export async function isAiEnabledForUser(userId: string): Promise<boolean> {
  return isAiEnabled(await getUserAiSettings(userId));
}

/** Fails closed: a missing connection counts as disabled. */
export async function isAiEnabledForConnection(connectionId: string): Promise<boolean> {
  const user = await getConnectionAiSettings(connectionId);
  return !!user && isAiEnabled(user.settings);
}

/** Throws FORBIDDEN when the user has turned AI off. */
export async function assertAiEnabled(userId: string): Promise<void> {
  if (!(await isAiEnabledForUser(userId)))
    throw new TRPCError({ code: 'FORBIDDEN', message: AI_DISABLED_MESSAGE });
}
