import { AppSidebar } from "@/components/ui/app-sidebar";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <div className="w-full bg-white dark:bg-black md:p-3">{children}</div>
    </>
  );
}
