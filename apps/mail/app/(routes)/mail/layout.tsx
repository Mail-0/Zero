import { KeyboardShortcuts } from "@/components/mail/keyboard-shortcuts";
import { AppSidebar } from "@/components/ui/app-sidebar";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <KeyboardShortcuts />
      <div className="w-full bg-white md:py-3 md:pr-3 dark:bg-black">{children}</div>
    </>
  );
}
