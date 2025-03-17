import { AppSidebar } from "@/components/ui/app-sidebar";

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <div className="w-full bg-white md:p-3 dark:bg-black">{children}</div>
    </>
  );
}
