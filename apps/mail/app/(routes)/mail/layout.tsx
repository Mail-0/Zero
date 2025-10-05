import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { RightSidebar } from '@/components/ui/right-sidebar';
import { OnboardingWrapper } from '@/components/onboarding';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { Outlet } from 'react-router';

export default function MailLayout() {
  return (
    <HotkeyProviderWrapper>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="bg-sidebar dark:bg-sidebar min-w-0 flex-1">
          <Outlet />
        </div>
        <RightSidebar />
      </div>
      <OnboardingWrapper />
    </HotkeyProviderWrapper>
  );
}
