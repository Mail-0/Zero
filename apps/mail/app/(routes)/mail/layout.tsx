import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { OnboardingWrapper } from '@/components/onboarding';

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <HotkeyProviderWrapper>
      <AppSidebar />
      <div className="bg-background w-full">{children}</div>
      <OnboardingWrapper />
    </HotkeyProviderWrapper>
  );
}
