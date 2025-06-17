import { defaultLabels, EProviders, type AppContext } from '../../types';
import { getContext } from 'hono/context-storage';
import { connection } from '../../db/schema';
import type { HonoContext } from '../../ctx';
import { env } from 'cloudflare:workers';

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
    const db = env.ZERO_DB.get(env.ZERO_DB.idFromName('global-db'));
    const connectionData = await db.findConnectionById(connectionId);
    return connectionData;
  }

  protected async initializeConnectionLabels(connectionId: string): Promise<void> {
    const existingLabels = await env.connection_labels.get(connectionId);
    if (!existingLabels?.trim().length) {
      await env.connection_labels.put(connectionId, JSON.stringify(defaultLabels));
    }
  }
}
