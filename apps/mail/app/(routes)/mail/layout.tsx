import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { AppSidebar } from '@/components/ui/app-sidebar';

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <HotkeyProviderWrapper>
      <AppSidebar />
      <div className="bg-lightBackground dark:bg-darkBackground w-full">{children}</div>
    </HotkeyProviderWrapper>
  );
}
