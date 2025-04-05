// app/providers.tsx
'use client';

import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import posthog from 'posthog-js';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
