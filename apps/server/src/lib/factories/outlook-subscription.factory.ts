import {
  BaseSubscriptionFactory,
  type SubscriptionData,
  type UnsubscriptionData,
} from './base-subscription.factory';
import { EProviders } from '../../types';

export class OutlookSubscriptionFactory extends BaseSubscriptionFactory {
  readonly providerId = EProviders.microsoft;

  public async subscribe(_: { body: SubscriptionData }): Promise<Response> {
    // TODO: Implement Outlook subscription logic
    // This will handle Microsoft Graph API subscriptions for Outlook

    throw new Error('Outlook subscription not implemented yet');
  }

  public async unsubscribe(_: { body: UnsubscriptionData }): Promise<Response> {
    // TODO: Implement Outlook unsubscription logic

    throw new Error('Outlook unsubscription not implemented yet');
  }

  public async verifyToken(_: string): Promise<boolean> {
    // TODO: Implement Microsoft Graph token verification

    throw new Error('Outlook token verification not implemented yet');
  }
}
