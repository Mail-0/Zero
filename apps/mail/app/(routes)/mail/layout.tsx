import { KeyboardShortcuts } from "@/components/mail/keyboard-shortcuts";
import { AppSidebar } from "@/components/ui/app-sidebar";
import AISidebar from "@/components/ui/ai-sidebar";
import AIInline from "@/components/ui/ai-inline";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <KeyboardShortcuts />
      <div className="w-full bg-white md:p-3 dark:bg-black">{children}</div>
      <AISidebar />
      <AIInline />
    </>
  );
}
