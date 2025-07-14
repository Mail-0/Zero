import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { OnboardingWrapper } from '@/components/onboarding';

import { NotificationProvider } from '@/components/party';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { Outlet, useLoaderData } from 'react-router';
import type { Route } from './+types/layout';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

export default function MailLayout() {
  return (
    <HotkeyProviderWrapper>
      <AppSidebar />
      <div className="bg-sidebar dark:bg-sidebar w-full">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
      <OnboardingWrapper />
      <NotificationProvider />
    </HotkeyProviderWrapper>
  );
}
