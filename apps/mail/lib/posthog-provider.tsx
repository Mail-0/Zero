// app/providers.tsx
'use client';

import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { useSession } from '@/lib/auth-client';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
    });
  }, []);

  useEffect(() => {
    if (session?.user) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      });
    }
  }, [session]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
