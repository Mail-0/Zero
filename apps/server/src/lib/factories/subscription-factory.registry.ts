// import { OutlookSubscriptionFactory } from './outlook-subscription.factory';
import { GoogleSubscriptionFactory } from './google-subscription.factory';
import { BaseSubscriptionFactory } from './base-subscription.factory';
import { EProviders } from '../../types';

// Provider factory registry
const subscriptionFactoryRegistry = new Map<EProviders, BaseSubscriptionFactory>();

// Register Google factory
const googleFactory = new GoogleSubscriptionFactory();
subscriptionFactoryRegistry.set(EProviders.google, googleFactory);

export function getSubscriptionFactory(provider: EProviders): BaseSubscriptionFactory {
  const factory = subscriptionFactoryRegistry.get(provider);
  if (!factory) {
    throw new Error(`No subscription factory registered for provider: ${provider}`);
  }
  return factory;
}

export function getAllRegisteredProviders(): EProviders[] {
  return Array.from(subscriptionFactoryRegistry.keys());
}

// Export individual factories for direct access if needed
export { googleFactory };
