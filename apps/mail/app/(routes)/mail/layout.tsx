import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { ComposeDialog } from '@/components/mail/compose-dialog';
import { OnboardingWrapper } from '@/components/onboarding';
import { NotificationProvider } from '@/components/party';
import { Outlet } from 'react-router';

export default function MailLayout() {
  return (
    <HotkeyProviderWrapper>
      <div className="bg-sidebar dark:bg-sidebar w-full min-w-0">
        <Outlet />
      </div>
      <ComposeDialog />
      <OnboardingWrapper />
      <NotificationProvider />
    </HotkeyProviderWrapper>
  );
}
