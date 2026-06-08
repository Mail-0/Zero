import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { UserProfileGate } from '@/components/user-profile-gate';
import { OnboardingWrapper } from '@/components/onboarding';
import { DoormanTopBar } from '@/components/ui/doorman-top-bar';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { Outlet } from 'react-router';

export default function MailLayout() {
  return (
    <HotkeyProviderWrapper>
      <UserProfileGate />
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <DoormanTopBar />
        <div className="flex min-h-0 flex-1">
          <AppSidebar topBarOffset />
          <div className="bg-sidebar dark:bg-sidebar flex h-full min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </div>
      <OnboardingWrapper />
    </HotkeyProviderWrapper>
  );
}
