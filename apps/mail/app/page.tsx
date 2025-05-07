import HomeContent from '@/components/home/HomeContent';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export default async function Home() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (session?.connectionId) {
    redirect('/mail/inbox');
  }

  return <HomeContent />;
}
