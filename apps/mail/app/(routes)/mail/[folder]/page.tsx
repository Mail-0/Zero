import { MailLayout } from "@/components/mail/mail";

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

  return <MailLayout />;
}
