import HomeContent from '@/components/home/HomeContent';
import { DemoMailLayout } from '@/components/mail/mail';
import { getSession } from '@/lib/auth-client';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect('/mail/inbox');
  }

  return <HomeContent />;
}
