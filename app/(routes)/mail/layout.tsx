import { AppSidebar } from "@/components/ui/app-sidebar";
import { Shortcutter } from "@/components/shortcutter";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <Shortcutter />
      <div className="w-full bg-sidebar md:p-3">{children}</div>
    </>
  );
}
