import { defaultLabels, EProviders, type AppContext } from '../../types';
import { connection } from '../../db/schema';
import { env } from 'cloudflare:workers';
import { createDb } from '../../db';

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

  protected async getConnectionFromDb(connectionId: string): Promise<any> {
    const db = createDb(env.HYPERDRIVE.connectionString);
    const { eq } = await import('drizzle-orm');

    const [connectionData] = await db
      .select()
      .from(connection)
      .where(eq(connection.id, connectionId));

    return connectionData;
  }

  protected async initializeConnectionLabels(connectionId: string): Promise<void> {
    const existingLabels = await env.connection_labels.get(connectionId);
    if (!existingLabels?.trim().length) {
      await env.connection_labels.put(connectionId, JSON.stringify(defaultLabels));
    }
  }
}
