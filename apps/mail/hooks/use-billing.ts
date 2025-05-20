import { useAutumn, useCustomer } from 'autumn-js/next';
import { useMemo } from 'react';

type Feature = {
  feature_id: string;
  included_usage: number;
  balance: number;
  unlimited: boolean;
};

type FeatureState = {
  total: number;
  remaining: number;
  unlimited: boolean;
  enabled: boolean;
};

type Features = {
  chatMessages: FeatureState;
  connections: FeatureState;
  brainActivity: FeatureState;
};

type Product = {
  id: string;
  name: string;
  [key: string]: any;
};

type Customer = {
  id: string;
  stripe_id?: string;
  products?: Product[];
  features?: Feature[];
  [key: string]: any;
};

type TrackParams = {
  featureId: string;
  value: number;
};

type BillingHook = {
  customer: Customer | null;
  refetch: () => Promise<void>;
  attach: (params: { productId: string; successUrl: string; authUrl?: string }) => Promise<void>;
  track: (params: TrackParams) => Promise<void>;
  openBillingPortal: () => Promise<void>;
  isPro: boolean;
  chatMessages: FeatureState;
  connections: FeatureState;
  brainActivity: FeatureState;
};

const DEFAULT_FEATURES: Features = {
  chatMessages: { total: 0, remaining: 0, unlimited: false, enabled: false },
  connections: { total: 0, remaining: 0, unlimited: false, enabled: false },
  brainActivity: { total: 0, remaining: 0, unlimited: false, enabled: false },
};

const FEATURE_IDS = {
  CHAT: 'chat-messages',
  CONNECTIONS: 'connections',
  BRAIN: 'brain-activity',
} as const;

const PRO_PLANS = ['pro-example', 'pro_annual', 'team', 'enterprise'] as const;

export const useBilling = (): BillingHook => {
  const { customer, refetch } = useCustomer();
  const { attach, track, openBillingPortal } = useAutumn();

  const isPro = useMemo(() => {
    if (!customer?.products || !Array.isArray(customer.products)) return false;
    return customer.products.some((product: Product) =>
      PRO_PLANS.some((plan) => product.id?.includes(plan) || product.name?.includes(plan)),
    );
  }, [customer]);

  const customerFeatures = useMemo(() => {
    if (!customer || !customer.features || !Array.isArray(customer.features))
      return DEFAULT_FEATURES;

    const features = customer.features.reduce(
      (acc: Features, feature: Feature) => {
        const id = feature.feature_id;
        if (id === FEATURE_IDS.CHAT) {
          acc.chatMessages = {
            total: feature.included_usage || 0,
            remaining: feature.balance || 0,
            unlimited: feature.unlimited,
            enabled: feature.unlimited || Number(feature.balance) > 0,
          };
        } else if (id === FEATURE_IDS.CONNECTIONS) {
          acc.connections = {
            total: feature.included_usage || 0,
            remaining: feature.balance || 0,
            unlimited: feature.unlimited,
            enabled: feature.unlimited || Number(feature.balance) > 0,
          };
        } else if (id === FEATURE_IDS.BRAIN) {
          acc.brainActivity = {
            total: feature.included_usage || 0,
            remaining: feature.balance || 0,
            unlimited: feature.unlimited,
            enabled: feature.unlimited || Number(feature.balance) > 0,
          };
        }
        return acc;
      },
      { ...DEFAULT_FEATURES },
    );

    return features;
  }, [customer]);

  return {
    customer,
    refetch,
    attach,
    track,
    openBillingPortal,
    isPro,
    ...customerFeatures,
  };
};
