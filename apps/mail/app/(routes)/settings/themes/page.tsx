import { Suspense } from 'react';
import { Separator } from '@/components/ui/separator';
import { ThemeManagement } from './theme-management';
import { EmptyPlaceholder } from '@/components/empty-placeholder';
import { getUserThemes, createDefaultThemes } from '@/actions/themes';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export const metadata = {
  title: 'Themes',
  description: 'Manage and customize your themes',
};

async function ThemeSettings() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return (
      <EmptyPlaceholder>
        <div className="text-center">
          <p>You need to be signed in to manage themes</p>
        </div>
      </EmptyPlaceholder>
    );
  }

  const { success, themes = [] } = await getUserThemes();

  if (!success || themes.length === 0) {
    // Create default themes for the user if they don't have any
    await createDefaultThemes();
    return (
      <EmptyPlaceholder>
        <div className="text-center">
          <p>Creating default themes for you...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Refresh the page to see your themes
          </p>
        </div>
      </EmptyPlaceholder>
    );
  }

  return <ThemeManagement initialThemes={themes} />;
}

export default function ThemesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Themes</h3>
        <p className="text-sm text-muted-foreground">
          Customize the appearance of your email client with personalized themes
        </p>
      </div>
      <Separator />
      <Suspense fallback={<div>Loading themes...</div>}>
        <ThemeSettings />
      </Suspense>
    </div>
  );
} 