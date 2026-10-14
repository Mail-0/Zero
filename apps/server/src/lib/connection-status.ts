import type { connection } from '../db/schema';

/**
 * IMAP connections keep their real credentials encrypted in `mail0_connection_imap`. The
 * connection row's token columns hold this marker instead (or the short-lived XOAUTH2 access
 * token), so the shared "null tokens = needs reauthorization" convention works for every
 * provider.
 */
export const IMAP_TOKEN_MARKER = 'imap:managed';

type ConnectionTokens = Pick<
  typeof connection.$inferSelect,
  'accessToken' | 'refreshToken' | 'providerId'
>;

/** Whether the connection has usable credentials (false means it must be reconnected). */
export const isConnectionActive = (conn: ConnectionTokens) =>
  !!conn.accessToken && !!conn.refreshToken;

/** Column values that mark a connection as needing reauthorization. */
export const disconnectedTokens = { accessToken: null, refreshToken: null } as const;
