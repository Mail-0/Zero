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

export const useBilling = () => {
  const { customer, refetch } = useCustomer();
  const { attach, track } = useAutumn();

  const customerFeatures = useMemo(() => {
    if (!customer) return DEFAULT_FEATURES;

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
    refetch,
    attach,
    track,
    ...customerFeatures,
  };
};
