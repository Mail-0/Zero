import { defaultLabels, EProviders, } from '../../types';

import { connection } from '../../db/schema';


import { env } from 'cloudflare:workers';
import { createDb } from '../../db';
import { eq } from 'drizzle-orm';

export interface SubscriptionData {
  connectionId?: string;
  silent?: boolean;
  force?: boolean;
}

export interface UnsubscriptionData {
  connectionId?: string;
  providerId?: EProviders;
}

export abstract class BaseSubscriptionFactory {
  abstract readonly providerId: EProviders;

  abstract subscribe(data: { body: SubscriptionData }): Promise<Response>;

  abstract unsubscribe(data: { body: UnsubscriptionData }): Promise<Response>;

  abstract verifyToken(token: string): Promise<boolean>;

  protected async getConnectionFromDb(connectionId: string) {
    // Revisit
    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
    const connectionData = await db.query.connection.findFirst({
      where: eq(connection.id, connectionId),
    });
    await conn.end();
    return connectionData;
  }

  protected async initializeConnectionLabels(connectionId: string): Promise<void> {
    const existingLabels = await env.connection_labels.get(connectionId);
    if (!existingLabels?.trim().length) {
      await env.connection_labels.put(connectionId, JSON.stringify(defaultLabels));
    }
  }
}
