import { connection } from '../db/schema';
import { createAuth } from './auth';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { env } from '../env';

/**
 * Gate for the public `/agents/:party/:room` route (WebSocket upgrades and HTTP).
 *
 * `routeAgentRequest` exposes every Durable Object binding by kebab-cased name, so
 * without this any internal object (zero-driver, zero-db, ...) is reachable.
 * Only the chat/sync agent is public, and only for the mailbox owner.
 *
 * Runs once per handshake, never per message, so streaming is unaffected. The
 * session is read from Better Auth's signed cookie cache (no DB/Redis on the hot
 * path) and connection ownership, which never changes, is memoized per isolate.
 */

const PUBLIC_PARTY = 'zero-agent';
/** Room the client joins before a mailbox is selected; it holds no mailbox data. */
const NO_MAILBOX_ROOM = 'general';

const OWNER_CACHE_MAX = 5_000;
/** Owners never change (ids are random UUIDs); the TTL only bounds access after a delete. */
const OWNER_CACHE_TTL_MS = 10 * 60_000;
const ownerCache = new Map<string, { userId: string; expires: number }>();

async function lookupConnectionOwner(connectionId: string): Promise<string | undefined> {
  const cached = ownerCache.get(connectionId);
  if (cached && cached.expires > Date.now()) return cached.userId;

  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  try {
    const [row] = await db
      .select({ userId: connection.userId })
      .from(connection)
      .where(eq(connection.id, connectionId))
      .limit(1);
    if (!row) return undefined; // not cached: the connection may be created moments later
    if (ownerCache.size >= OWNER_CACHE_MAX) {
      ownerCache.delete(ownerCache.keys().next().value!);
    }
    ownerCache.set(connectionId, { userId: row.userId, expires: Date.now() + OWNER_CACHE_TTL_MS });
    return row.userId;
  } finally {
    await conn.end().catch(() => {});
  }
}

const deny = (status: 401 | 403 | 404) =>
  new Response(status === 404 ? 'Not Found' : status === 401 ? 'Unauthorized' : 'Forbidden', {
    status,
  });

/** Returns a Response to reject the request, or undefined to let it through. */
export async function authorizeAgentRequest(
  req: Request,
  { party, name }: { party: string | number; name: string },
): Promise<Response | undefined> {
  if (party !== PUBLIC_PARTY) return deny(404);
  if (!req.headers.get('Cookie')) return deny(401);

  const isMailboxRoom = name !== NO_MAILBOX_ROOM;
  const [session, ownerId] = await Promise.all([
    createAuth()
      .api.getSession({ headers: req.headers })
      .catch(() => null),
    isMailboxRoom ? lookupConnectionOwner(name).catch(() => undefined) : undefined,
  ]);

  const userId = session?.user?.id;
  if (!userId) return deny(401);
  if (isMailboxRoom && ownerId !== userId) return deny(403);
  return undefined;
}
