import { useAutumn, useCustomer } from 'autumn-js/next';
import { useMemo } from 'react';

export const useBilling = () => {
  const { customer, refetch } = useCustomer();
  const { attach, track } = useAutumn();

  const customerFeatures = useMemo(() => {
    if (!customer)
      return {
        chatMessages: { total: 0, remaining: 0, unlimited: false },
        connections: { total: 0, remaining: 0, unlimited: false },
        brainActivity: { total: 0, remaining: 0, unlimited: false },
      };
    const chatFeature = customer.features.find(
      (feature: { feature_id: string }) => feature.feature_id === 'chat-messages',
    );
    const connectionsFeature = customer.features.find(
      (feature: { feature_id: string }) => feature.feature_id === 'connections',
    );
    const brainActivityFeature = customer.features.find(
      (feature: { feature_id: string }) => feature.feature_id === 'brain-activity',
    );
    return {
      chatMessages: {
        total: chatFeature.included_usage || 0,
        remaining: chatFeature.balance || 0,
        unlimited: chatFeature.unlimited,
        enabled: chatFeature.unlimited || Number(chatFeature.balance) > 0,
      },
      connections: {
        total: connectionsFeature.included_usage || 0,
        remaining: connectionsFeature.balance || 0,
        unlimited: connectionsFeature.unlimited,
        enabled: connectionsFeature.unlimited || Number(connectionsFeature.balance) > 0,
      },
      brainActivity: {
        total: brainActivityFeature.included_usage || 0,
        remaining: brainActivityFeature.balance || 0,
        unlimited: brainActivityFeature.unlimited,
        enabled: brainActivityFeature.unlimited || Number(brainActivityFeature.balance) > 0,
      },
    };
  }, [customer]);

  return {
    refetch,
    attach,
    track,
    ...customerFeatures,
  };
};
