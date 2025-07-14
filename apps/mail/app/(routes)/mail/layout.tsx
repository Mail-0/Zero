import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { OnboardingWrapper } from '@/components/onboarding';

import InboxLoader from '@/components/loaders/inbox-loader';
import { NotificationProvider } from '@/components/party';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { Outlet } from 'react-router';
import { Suspense } from 'react';

export default function MailLayout() {
  return (
    <HotkeyProviderWrapper>
      <AppSidebar />
      <div className="bg-sidebar dark:bg-sidebar w-full">
        <Suspense fallback={<InboxLoader />}>
          <Outlet />
        </Suspense>
      </div>
      <OnboardingWrapper />
      <NotificationProvider />
    </HotkeyProviderWrapper>
  );
}
