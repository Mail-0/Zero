import { useAutumn, useCustomer } from 'autumn-js/react';
import { signOut } from '@/lib/auth-client';
import { isProCustomer } from '@/lib/utils';
import { useEffect, useMemo } from 'react';

type FeatureState = {
  total: number;
  remaining: number;
  unlimited: boolean;
  enabled: boolean;
  usage: number;
  nextResetAt: number | null;
  interval: string;
  included_usage: number;
};

type Features = {
  chatMessages: FeatureState;
  connections: FeatureState;
  brainActivity: FeatureState;
};

const DEFAULT_FEATURES: Features = {
  chatMessages: {
    total: 0,
    remaining: 0,
    unlimited: false,
    enabled: false,
    usage: 0,
    nextResetAt: null,
    interval: '',
    included_usage: 0,
  },
  connections: {
    total: 0,
    remaining: 0,
    unlimited: false,
    enabled: false,
    usage: 0,
    nextResetAt: null,
    interval: '',
    included_usage: 0,
  },
  brainActivity: {
    total: 0,
    remaining: 0,
    unlimited: false,
    enabled: false,
    usage: 0,
    nextResetAt: null,
    interval: '',
    included_usage: 0,
  },
};

const FEATURE_IDS = {
  CHAT: 'chat-messages',
  CONNECTIONS: 'connections',
  BRAIN: 'brain-activity',
} as const;

export const useBilling = () => {
  const { customer, refetch, isLoading, error } = useCustomer();
  const { attach, track, openBillingPortal } = useAutumn();

  useEffect(() => {
    if (error) signOut();
  }, [error]);

  const { isPro, ...customerFeatures } = useMemo(() => {
    // Force Pro mode by default for all users
    const isPro = true;

    // Development override: unlock ALL features regardless of Autumn billing data
    const OVERRIDE_TOTAL = 1_000_000;
    const OVERRIDE_FEATURE: FeatureState = {
      total: OVERRIDE_TOTAL,
      remaining: OVERRIDE_TOTAL,
      unlimited: true,
      enabled: true,
      usage: 0,
      nextResetAt: null,
      interval: 'monthly',
      included_usage: OVERRIDE_TOTAL,
    };

    const features: Features = {
      chatMessages: { ...OVERRIDE_FEATURE },
      connections: { ...OVERRIDE_FEATURE },
      brainActivity: { ...OVERRIDE_FEATURE },
    };

    // Ignore customer?.features intentionally to ensure local dev is fully unlocked
    return { isPro, ...features };
  }, [customer]);

  return {
    isLoading,
    customer,
    refetch,
    attach,
    track,
    openBillingPortal,
    isPro,
    ...customerFeatures,
  };
};
