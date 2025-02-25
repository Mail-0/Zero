import { cookies } from "next/headers";

import { accounts } from "@/components/mail/data";
import { Mail } from "@/components/mail/mail";

export default async function MailPage() {
  const cookieStore = await cookies();
  const layout = cookieStore.get("react-resizable-panels:layout:mail");
  const collapsed = cookieStore.get("react-resizable-panels:collapsed");

  const defaultLayout = layout ? JSON.parse(layout.value) : undefined;
  const defaultCollapsed = collapsed ? JSON.parse(collapsed.value) : undefined;

  return (
    <div className="w-full bg-white dark:bg-sidebar">
      <div className="flex-col dark:bg-[#090909] dark:text-gray-100 md:m-2 md:flex md:rounded-md md:border">
        <Mail
          accounts={accounts}
          folder={"inbox"}
          defaultLayout={defaultLayout}
          defaultCollapsed={defaultCollapsed}
          navCollapsedSize={4}
        />
      </div>
    </div>
  );
}
