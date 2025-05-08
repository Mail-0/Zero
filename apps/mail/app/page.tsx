import HomeContent from '@/components/home/HomeContent';
import { authProxy } from '@/lib/auth-proxy';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function Home() {
  const headersList = await headers();
  const session = await authProxy.api.getSession({ headers: headersList });

  if (session?.connectionId) {
    redirect('/mail/inbox');
  }

  return <HomeContent />;
}
