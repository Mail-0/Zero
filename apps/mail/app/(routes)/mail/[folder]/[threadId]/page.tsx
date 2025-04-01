import { getMail } from '@/actions/mail';

interface MailPageProps {
  params: Promise<{
    threadId: string;
  }>;
}
export default async function MailPage({ params }: MailPageProps) {
  const { threadId } = await params;
  const thread = await getMail({ id: threadId });

  return <MailLayout />;
}
