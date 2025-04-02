                                import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsLayoutContent } from '@/components/ui/settings-layout-content';
import { SettingsLayoutSkeleton } from '@/components/ui/settings-layout-skeleton';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session) {
    redirect('/login');
  }

  return (
    <Suspense fallback={<SettingsLayoutSkeleton />}>
      <SettingsLayoutContent>{children}</SettingsLayoutContent>
    </Suspense>
  );
}
