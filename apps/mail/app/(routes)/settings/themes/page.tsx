'use client';

import { Separator } from '@/components/ui/separator';
import { ThemeManagement } from './theme-management';
import { CustomThemeProvider } from '@/providers/custom-theme-provider';
import { useSession } from '@/lib/auth-client';
import { EmptyPlaceholder } from '@/components/empty-placeholder';
import { useEffect, useState } from 'react';

export default function ThemesPage() {
  const { data: session } = useSession();
  // Add a local loading state, default to true until session is checked.
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    // session can be null if not logged in, or an object if logged in.
    // consider loading finished once useSession has had a chance to run.
    setIsSessionLoading(false);
  }, [session]);

  if (isSessionLoading) {
    return (
      <div className="space-y-6 p-4">
         <div>Loading session...</div>
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Themes</h3>
          <p className="text-sm text-muted-foreground">
            Customize the appearance of your email client with personalized themes
          </p>
        </div>
        <Separator />
        <EmptyPlaceholder>
          <div className="text-center">
            <p>You need to be signed in to manage themes.</p>
          </div>
        </EmptyPlaceholder>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Themes</h3>
        <p className="text-sm text-muted-foreground">
          Customize the appearance of your email client with personalized themes
        </p>
      </div>
      <Separator />
      <CustomThemeProvider>
        {/* ThemeManagement will now fetch its own data. Passing empty initialThemes */}
        {/* and ThemeManagement will handle loading and empty states itself */}
        <ThemeManagement initialThemes={[]} /> 
      </CustomThemeProvider>
    </div>
  );
} 