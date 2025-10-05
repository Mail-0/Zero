import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { RightSidebar } from '@/components/ui/right-sidebar';
import { OnboardingWrapper } from '@/components/onboarding';
import type { FakeEmail } from '@/lib/fake-organised-data';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { useParams } from 'react-router';
import { Outlet } from 'react-router';
import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';

export const selectedOrganisedEmailAtom = atom<FakeEmail | null>(null);

export default function MailLayout() {
  const [organisedEmail, setOrganisedEmail] = useAtom(selectedOrganisedEmailAtom);
  const params = useParams<{ folder: string }>();

  // Reset organised email when leaving organised view
  useEffect(() => {
    if (params?.folder !== 'organised') {
      setOrganisedEmail(null);
    }
  }, [params?.folder, setOrganisedEmail]);

  return (
    <HotkeyProviderWrapper>
      <div className="flex h-screen w-full">
        <AppSidebar organisedEmail={organisedEmail} />
        <div className="bg-sidebar dark:bg-sidebar min-w-0 flex-1">
          <Outlet />
        </div>
        <RightSidebar />
      </div>
      <OnboardingWrapper />
    </HotkeyProviderWrapper>
  );
}
