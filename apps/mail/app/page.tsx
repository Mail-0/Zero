import HomeContent from '@/components/home/HomeContent';
import { authProxy } from '@/lib/auth-proxy';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function Home() {
  const headersList = new Headers(Object.fromEntries(await (await headers()).entries()));
  const session = await authProxy.api.getSession({ headers: headersList });

  if (session?.connectionId) {
    redirect('/mail/inbox');
  }

  return <HomeContent />;
}
