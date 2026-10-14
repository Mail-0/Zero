import { IMAP_TOKEN_MARKER, isConnectionActive } from './connection-status';
import type { ImapManagerSettings } from './driver/types';
import { connection, connectionImap } from '../db/schema';
import type { DriverRpcDO } from '../routes/agent/rpc';
import type { LabelStorage } from './mail-label-store';
import { disposeRpc, scopedRpc } from './scoped-rpc';
import { getContext } from 'hono/context-storage';
import type { HonoContext } from '../ctx';
import { createClient } from 'dormroom';
import { createDriver } from './driver';
import type { DbRpcDO } from '../main';
import { env } from '../env';

export const getZeroDB = async (userId: string) => {
  return scopedRpc<DbRpcDO>(async () => {
    const stub = env.ZERO_DB.get(env.ZERO_DB.idFromName(userId));
    return stub.setMetaData(userId);
  });
};

export const getZeroClient = async (connectionId: string, executionCtx: ExecutionContext) => {
  const agent = createClient({
    doNamespace: env.ZERO_DRIVER,
    ctx: executionCtx,
    configs: [{ name: connectionId }],
  }).stub;

  await agent.setName(connectionId);
  await agent.setupAuth();

  return agent;
};

export const getZeroAgent = async (connectionId: string) => {
  const client = scopedRpc<DriverRpcDO>(async () => {
    const stub = env.ZERO_DRIVER.get(env.ZERO_DRIVER.idFromName(connectionId));
    const target = await stub.setMetaData(connectionId);
    try {
      await target.setupAuth();
      return target;
    } catch (error) {
      disposeRpc(target);
      throw error;
    }
  });
  return client;
};

export const getZeroSocketAgent = async (connectionId: string) => {
  const stub = env.ZERO_AGENT.get(env.ZERO_AGENT.idFromName(connectionId));
  await stub.setName(connectionId);
  return stub;
};

export const getActiveConnection = async () => {
  const c = getContext<HonoContext>();
  const { sessionUser } = c.var;
  if (!sessionUser) throw new Error('Session Not Found');

  const db = await getZeroDB(sessionUser.id);

  const userData = await db.findUser();

  if (userData?.defaultConnectionId) {
    const activeConnection = await db.findUserConnection(userData.defaultConnectionId);
    if (activeConnection) return activeConnection;
  }

  const firstConnection = await db.findFirstConnection();
  if (!firstConnection) {
    console.error(`No connections found for user ${sessionUser.id}`);
    throw new Error('No connections found for user');
  }

  return firstConnection;
};

/** Builds the driver's IMAP settings from a `mail0_connection_imap` row. */
export const imapSettingsFromRow = (
  activeConnection: typeof connection.$inferSelect,
  row: typeof connectionImap.$inferSelect,
  onSecretRotated?: ImapManagerSettings['onSecretRotated'],
): ImapManagerSettings => ({
  connectionId: activeConnection.id,
  displayName: activeConnection.name,
  imap: {
    host: row.imapHost,
    port: row.imapPort,
    security: row.imapSecurity,
    username: row.imapUsername,
  },
  smtp: {
    host: row.smtpHost,
    port: row.smtpPort,
    security: row.smtpSecurity,
    username: row.smtpUsername,
  },
  authMethod: row.authMethod,
  oauthProvider: row.oauthProvider,
  secret: { ciphertext: row.encryptedSecret, iv: row.iv, keyVersion: row.keyVersion },
  accessToken:
    row.authMethod === 'xoauth2' && activeConnection.accessToken !== IMAP_TOKEN_MARKER
      ? activeConnection.accessToken
      : null,
  serverSavesSent: row.serverSavesSent,
  onSecretRotated,
});

export const connectionToDriver = (
  activeConnection: typeof connection.$inferSelect,
  extras: { imap?: ImapManagerSettings; storage?: LabelStorage } = {},
) => {
  if (!isConnectionActive(activeConnection)) {
    throw new Error(`Invalid connection ${JSON.stringify(activeConnection?.id)}`);
  }
  if (activeConnection.providerId === 'imap' && (!extras.imap || !extras.storage)) {
    throw new Error('IMAP connections can only be opened inside their mailbox');
  }

  return createDriver(activeConnection.providerId, {
    auth: {
      userId: activeConnection.userId,
      accessToken: activeConnection.accessToken!,
      refreshToken: activeConnection.refreshToken!,
      email: activeConnection.email,
    },
    imap: extras.imap,
    storage: extras.storage,
  });
};

export const verifyToken = async (token: string) => {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to verify token: ${await response.text()}`);
  }

  const data: unknown = await response.json();
  return !!data;
};
