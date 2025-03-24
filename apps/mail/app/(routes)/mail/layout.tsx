<<<<<<< HEAD
import { KeyboardShortcuts } from "@/components/mail/keyboard-shortcuts";
import { AppSidebar } from "@/components/ui/app-sidebar";
import AISidebar from "@/components/ui/ai-sidebar";
import AIInline from "@/components/ui/ai-inline";
=======
import { KeyboardShortcuts } from '@/components/mail/keyboard-shortcuts';
import { AppSidebar } from '@/components/ui/app-sidebar';
>>>>>>> origin/staging

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <KeyboardShortcuts />
<<<<<<< HEAD
      <div className="w-full bg-white md:p-3 dark:bg-black">{children}</div>
      <AISidebar />
      <AIInline />
=======
      <div className="w-full bg-white md:py-3 md:pr-2 dark:bg-black">{children}</div>
>>>>>>> origin/staging
    </>
  );
}
