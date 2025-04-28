import { AppSidebar } from '@/components/ui/app-sidebar';
import { GlobalHotkeys } from '@/lib/hotkeys/global-hotkeys';
import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <HotkeyProviderWrapper>
      <AppSidebar />
      <GlobalHotkeys />
      <div className="w-full bg-lightBackground dark:bg-darkBackground">{children}</div>
    </HotkeyProviderWrapper>
  );
}
