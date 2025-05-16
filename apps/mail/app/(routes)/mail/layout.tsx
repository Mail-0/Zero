import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { OnboardingWrapper } from '@/components/onboarding';
import { NotificationProvider } from '@/components/party';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { headers } from 'next/headers';
export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  return (
    <HotkeyProviderWrapper>
      <AppSidebar />
      <div className="bg-lightBackground dark:bg-darkBackground w-full">{children}</div>
      <OnboardingWrapper />
      <NotificationProvider headers={Object.fromEntries(headersList.entries())} />
    </HotkeyProviderWrapper>
  );
}
