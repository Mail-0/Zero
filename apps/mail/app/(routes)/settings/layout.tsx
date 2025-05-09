import { SettingsLayoutContent } from '@/components/ui/settings-content';
import { authProxy } from '@/lib/auth-proxy';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Suspense } from 'react';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const headersList = new Headers(Object.fromEntries(await (await headers()).entries()));
  const session = await authProxy.api.getSession({ headers: headersList });

  if (!session) {
    redirect('/login');
  }

  return (
    <Suspense fallback={<SettingsLayoutSkeleton />}>
      <SettingsLayoutContent>{children}</SettingsLayoutContent>
    </Suspense>
  );
}

function SettingsLayoutSkeleton() {
  return (
    <>
      <div className="hidden lg:flex lg:w-80" />
      <div className="bg-sidebar w-full md:p-3">
        <div className="bg-muted h-[calc(100svh-1.5rem)] animate-pulse md:rounded-2xl" />
      </div>
    </>
  );
}
