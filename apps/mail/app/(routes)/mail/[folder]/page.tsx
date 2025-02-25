import { cookies } from "next/headers";

import { accounts } from "@/components/mail/data";
import { Mail } from "@/components/mail/mail";

interface MailPageProps {
  params: Promise<{
    folder: string;
  }>;
}

const ALLOWED_FOLDERS = ["inbox", "draft", "sent", "spam", "trash", "archive"];

export default async function MailPage({ params }: MailPageProps) {
  const { folder } = await params;

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return <div>Invalid folder</div>;
  }

  const cookieStore = await cookies();
  const layout = cookieStore.get("react-resizable-panels:layout:mail");
  const collapsed = cookieStore.get("react-resizable-panels:collapsed");

  const defaultLayout = layout ? JSON.parse(layout.value) : undefined;
  const defaultCollapsed = collapsed ? JSON.parse(collapsed.value) : undefined;

  return (
    <Mail
      accounts={accounts}
      folder={folder}
      defaultLayout={defaultLayout}
      defaultCollapsed={defaultCollapsed}
      navCollapsedSize={4}
    />
  );
}
