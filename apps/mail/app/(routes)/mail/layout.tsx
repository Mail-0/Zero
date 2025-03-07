import { KeyboardShortcuts } from "@/components/mail/keyboard-shortcuts";
import { AppSidebar } from "@/components/ui/app-sidebar";
import AISidebar from "@/components/ui/ai-sidebar";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <KeyboardShortcuts />
      <div className="w-full bg-white py-3 pr-3 dark:bg-black">{children}</div>
      <AISidebar />
    </>
  );
}
